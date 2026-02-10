"""
Utility functions for converting OneDetailed (ridership detail) data to BoardingAlighting data.
"""
import csv
import io
from collections import defaultdict
from datetime import datetime
from typing import Optional, Dict, List, Tuple, Any
from zoneinfo import ZoneInfo

import pandas as pd
import pytz
from django.db.models import QuerySet

from gtfs.models import StopTimes, RidershipRecord

# JST timezone for date extraction
JST = ZoneInfo("Asia/Tokyo")


def get_stop_sequence_map(scenario_id: str, trip_ids: List[str]) -> Dict[Tuple[str, str], int]:
    """
    Bulk fetch stop_sequence for multiple trips.
    Returns dict with (trip_id, stop_id) -> stop_sequence mapping.
    """
    if not trip_ids:
        return {}
    
    stop_times = StopTimes.objects.filter(
        scenario_id=scenario_id,
        trip_id__in=trip_ids
    ).values('trip_id', 'stop_id', 'stop_sequence')
    
    return {
        (st['trip_id'], st['stop_id']): st['stop_sequence'] 
        for st in stop_times
    }


def parse_date_to_yyyymmdd(dt_value) -> Optional[str]:
    """Parse datetime value and return date string in YYYYMMDD format."""
    if pd.isna(dt_value) if not isinstance(dt_value, datetime) else dt_value is None:
        return None
    
    if isinstance(dt_value, datetime):
        return dt_value.strftime('%Y%m%d')
    
    if isinstance(dt_value, str):
        for fmt in ['%Y-%m-%d %H:%M:%S', '%Y-%m-%d', '%Y/%m/%d %H:%M:%S', '%Y/%m/%d']:
            try:
                parsed = datetime.strptime(dt_value, fmt)
                return parsed.strftime('%Y%m%d')
            except ValueError:
                continue
    
    return None


def parse_datetime_to_yyyymmdd(dt_value: Optional[datetime]) -> Optional[str]:
    """Parse datetime object and return date string in YYYYMMDD format (JST).

    Data in database is stored in UTC. We need to convert to JST to get the correct date.
    """
    if dt_value is None:
        return None

    # Convert UTC to JST before extracting date
    if dt_value.tzinfo is not None:
        dt_value = dt_value.astimezone(JST)

    return dt_value.strftime('%Y%m%d')


def safe_str(value) -> str:
    """Convert value to string safely, returning empty string for NaN/None."""
    if value is None:
        return ''
    if isinstance(value, float) and pd.isna(value):
        return ''
    return str(value)


def safe_int(value) -> Optional[int]:
    """Convert value to int safely, returning None for NaN/None."""
    if value is None:
        return None
    if isinstance(value, float) and pd.isna(value):
        return None
    try:
        return int(value)
    except (ValueError, TypeError):
        return None


def read_uploaded_file(file_obj, filename: str) -> pd.DataFrame:
    """
    Read uploaded file (Excel or CSV) and return pandas DataFrame.
    """
    filename_lower = filename.lower()
    
    if filename_lower.endswith('.xlsx') or filename_lower.endswith('.xls'):
        return pd.read_excel(file_obj)
    elif filename_lower.endswith('.csv'):
        for encoding in ['utf-8', 'shift_jis', 'cp932']:
            try:
                file_obj.seek(0)
                return pd.read_csv(file_obj, encoding=encoding)
            except UnicodeDecodeError:
                continue
        raise ValueError('Unable to decode CSV file with supported encodings')
    else:
        raise ValueError(f'Unsupported file format: {filename}. Supported formats: .xlsx, .xls, .csv')


def convert_one_detailed_to_boarding_alighting(
    df: pd.DataFrame, 
    scenario_id: str
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Convert OneDetailed DataFrame to BoardingAlighting data.
    
    Args:
        df: pandas DataFrame containing OneDetailed (ridership detail) data
        scenario_id: Scenario UUID for stop_sequence lookup
        
    Returns:
        Tuple of (boarding_alighting_rows, errors)
    """
    errors = []
    entries = []  # List of dicts: {date, agency_id, route_id, trip_id, stop_id, stop_sequence, is_boarding}
    
    # Collect all trip_ids for bulk lookup
    trip_ids = df['trip_code'].dropna().unique().tolist()
    trip_ids = [str(t) for t in trip_ids]
    
    # Bulk fetch stop sequences
    stop_sequence_map = get_stop_sequence_map(scenario_id, trip_ids)
    
    # Process each row
    for idx, row in df.iterrows():
        row_number = idx + 2  # Excel row number (1-based + header)
        
        agency_id = safe_str(row.get('operating_agency_name', ''))
        route_id = safe_str(row.get('route_id', ''))
        trip_id = safe_str(row.get('trip_code', ''))
        
        if not route_id:
            errors.append({
                'row': row_number,
                'field': 'route_id',
                'message': 'route_id is required but missing'
            })
            continue
        
        if not trip_id:
            errors.append({
                'row': row_number,
                'field': 'trip_code',
                'message': 'trip_code is required but missing'
            })
            continue
        
        # Process boarding
        boarding_stop_id = safe_str(row.get('boarding_station_code', ''))
        boarding_date = parse_date_to_yyyymmdd(row.get('boarding_at'))
        boarding_seq = safe_int(row.get('boarding_station_sequence'))
        
        if boarding_stop_id and boarding_date:
            if boarding_seq is None:
                boarding_seq = stop_sequence_map.get((trip_id, boarding_stop_id))
            
            entries.append({
                'date': boarding_date,
                'agency_id': agency_id,
                'route_id': route_id,
                'trip_id': trip_id,
                'stop_id': boarding_stop_id,
                'stop_sequence': boarding_seq,
                'is_boarding': True
            })
        
        # Process alighting
        alighting_stop_id = safe_str(row.get('alighting_station_code', ''))
        alighting_date = parse_date_to_yyyymmdd(row.get('alighting_at'))
        alighting_seq = safe_int(row.get('alighting_station_sequence'))
        
        if alighting_stop_id and alighting_date:
            if alighting_seq is None:
                alighting_seq = stop_sequence_map.get((trip_id, alighting_stop_id))
            
            entries.append({
                'date': alighting_date,
                'agency_id': agency_id,
                'route_id': route_id,
                'trip_id': trip_id,
                'stop_id': alighting_stop_id,
                'stop_sequence': alighting_seq,
                'is_boarding': False
            })
    
    # Aggregate entries
    boarding_alighting_rows = aggregate_entries_to_boarding_alighting(entries)
    
    return boarding_alighting_rows, errors


def convert_ridership_records_to_boarding_alighting(
    records: QuerySet,
    scenario_id: str
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Convert RidershipRecord queryset to BoardingAlighting data.
    
    Args:
        records: QuerySet of RidershipRecord objects
        scenario_id: Scenario UUID for stop_sequence lookup
        
    Returns:
        Tuple of (boarding_alighting_rows, errors)
    """
    errors = []
    entries = []
    
    # Collect all trip_ids for bulk lookup
    trip_ids = list(records.exclude(trip_code='').exclude(trip_code__isnull=True)
                    .values_list('trip_code', flat=True).distinct())
    
    # Bulk fetch stop sequences
    stop_sequence_map = get_stop_sequence_map(scenario_id, trip_ids)
    
    # Process each record
    for record in records:
        row_number = record.source_row_number or record.ridership_record_id
        
        agency_id = record.operating_agency_name or ''
        route_id = record.route_id or ''
        trip_id = record.trip_code or ''
        
        if not route_id:
            errors.append({
                'row': row_number,
                'field': 'route_id',
                'message': 'route_id is required but missing'
            })
            continue
        
        if not trip_id:
            errors.append({
                'row': row_number,
                'field': 'trip_code',
                'message': 'trip_code is required but missing'
            })
            continue
        
        # Process boarding
        boarding_stop_id = record.boarding_station_code or ''
        boarding_date = parse_datetime_to_yyyymmdd(record.boarding_at)
        boarding_seq = record.boarding_station_sequence
        
        if boarding_stop_id and boarding_date:
            if boarding_seq is None:
                boarding_seq = stop_sequence_map.get((trip_id, boarding_stop_id))
            
            entries.append({
                'date': boarding_date,
                'agency_id': agency_id,
                'route_id': route_id,
                'trip_id': trip_id,
                'stop_id': boarding_stop_id,
                'stop_sequence': boarding_seq,
                'is_boarding': True
            })
        
        # Process alighting
        alighting_stop_id = record.alighting_station_code or ''
        alighting_date = parse_datetime_to_yyyymmdd(record.alighting_at)
        alighting_seq = record.alighting_station_sequence
        
        if alighting_stop_id and alighting_date:
            if alighting_seq is None:
                alighting_seq = stop_sequence_map.get((trip_id, alighting_stop_id))
            
            entries.append({
                'date': alighting_date,
                'agency_id': agency_id,
                'route_id': route_id,
                'trip_id': trip_id,
                'stop_id': alighting_stop_id,
                'stop_sequence': alighting_seq,
                'is_boarding': False
            })
    
    # Aggregate entries
    boarding_alighting_rows = aggregate_entries_to_boarding_alighting(entries)
    
    return boarding_alighting_rows, errors


def aggregate_entries_to_boarding_alighting(
    entries: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Aggregate boarding/alighting entries by key fields.
    
    Args:
        entries: List of entry dicts with is_boarding flag
        
    Returns:
        List of aggregated boarding_alighting rows
    """
    aggregated = defaultdict(lambda: {'count_geton': 0, 'count_getoff': 0})
    
    for entry in entries:
        key = (
            entry['date'],
            entry['agency_id'],
            entry['route_id'],
            entry['trip_id'],
            entry['stop_id'],
            entry['stop_sequence']
        )
        if entry['is_boarding']:
            aggregated[key]['count_geton'] += 1
        else:
            aggregated[key]['count_getoff'] += 1
    
    # Build result rows
    boarding_alighting_rows = []
    for key, counts in aggregated.items():
        boarding_alighting_rows.append({
            'date': key[0],
            'agency_id': key[1],
            'route_id': key[2],
            'trip_id': key[3],
            'stop_id': key[4],
            'stop_sequence': key[5],
            'count_geton': counts['count_geton'],
            'count_getoff': counts['count_getoff']
        })
    
    # Sort by date, route_id, trip_id, stop_sequence
    boarding_alighting_rows.sort(key=lambda x: (
        x['date'],
        x['route_id'],
        x['trip_id'],
        x['stop_sequence'] if x['stop_sequence'] is not None else 9999
    ))
    
    return boarding_alighting_rows


def boarding_alighting_rows_to_csv(boarding_alighting_rows: List[Dict[str, Any]]) -> str:
    """Convert boarding alighting rows to CSV string."""
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow([
        'date', 'agency_id', 'route_id', 'trip_id', 
        'stop_id', 'stop_sequence', 'count_geton', 'count_getoff'
    ])
    
    # Data
    for row in boarding_alighting_rows:
        writer.writerow([
            row['date'],
            row['agency_id'],
            row['route_id'],
            row['trip_id'],
            row['stop_id'],
            row['stop_sequence'] if row['stop_sequence'] is not None else '',
            row['count_geton'],
            row['count_getoff']
        ])
    
    return output.getvalue()