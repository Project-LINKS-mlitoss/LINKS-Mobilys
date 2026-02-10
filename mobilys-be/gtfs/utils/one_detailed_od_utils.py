"""
Utility functions for converting OneDetailed (ridership detail) data to OD (Origin-Destination) data.
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


def parse_date_to_yyyymmdd(dt_value) -> Optional[str]:
    """Parse datetime value and return date string in YYYYMMDD format."""
    if dt_value is None:
        return None
    
    # Handle pandas NaN/NaT
    if isinstance(dt_value, float) and pd.isna(dt_value):
        return None
    
    if pd.isna(dt_value):
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


def convert_one_detailed_to_od(
    df: pd.DataFrame, 
    scenario_id: str
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Convert OneDetailed DataFrame to OD (Origin-Destination) data.
    
    Args:
        df: pandas DataFrame containing OneDetailed (ridership detail) data
        scenario_id: Scenario UUID (not used for OD, but kept for consistency)
        
    Returns:
        Tuple of (od_rows, errors)
        
    OD Data Format:
        - date: from boarding_at (YYYYMMDD)
        - agency_id: from operating_agency_code
        - route_id: from route_id
        - stopid_geton: from boarding_station_code
        - stopid_getoff: from alighting_station_code
        - count: aggregated count of records with same combination
    """
    errors = []
    entries = []  # List of tuples: (date, agency_id, route_id, stopid_geton, stopid_getoff)
    
    # Process each row
    for idx, row in df.iterrows():
        row_number = idx + 2  # Excel row number (1-based + header)
        
        # Get required fields
        route_id = safe_str(row.get('route_id', ''))
        boarding_station_code = safe_str(row.get('boarding_station_code', ''))
        alighting_station_code = safe_str(row.get('alighting_station_code', ''))
        boarding_date = parse_date_to_yyyymmdd(row.get('boarding_at'))
        
        # agency_id from operating_agency_code (not operating_agency_name)
        agency_id = safe_str(row.get('operating_agency_code', ''))
        
        # Validation
        if not route_id:
            errors.append({
                'row': row_number,
                'field': 'route_id',
                'message': 'route_id is required but missing'
            })
            continue
        
        if not boarding_station_code:
            errors.append({
                'row': row_number,
                'field': 'boarding_station_code',
                'message': 'boarding_station_code is required but missing'
            })
            continue
        
        if not alighting_station_code:
            errors.append({
                'row': row_number,
                'field': 'alighting_station_code',
                'message': 'alighting_station_code is required but missing'
            })
            continue
        
        if not boarding_date:
            errors.append({
                'row': row_number,
                'field': 'boarding_at',
                'message': 'boarding_at is required but missing or invalid'
            })
            continue
        
        # Add entry for aggregation
        entries.append({
            'date': boarding_date,
            'agency_id': agency_id,
            'route_id': route_id,
            'stopid_geton': boarding_station_code,
            'stopid_getoff': alighting_station_code
        })
    
    # Aggregate entries
    od_rows = aggregate_entries_to_od(entries)
    
    return od_rows, errors


def convert_ridership_records_to_od(
    records: QuerySet,
    scenario_id: str
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    Convert RidershipRecord queryset to OD (Origin-Destination) data.
    
    Args:
        records: QuerySet of RidershipRecord objects
        scenario_id: Scenario UUID (not used for OD, but kept for consistency)
        
    Returns:
        Tuple of (od_rows, errors)
        
    OD Data Format:
        - date: from boarding_at (YYYYMMDD)
        - agency_id: from operating_agency_code
        - route_id: from route_id
        - stopid_geton: from boarding_station_code
        - stopid_getoff: from alighting_station_code
        - count: aggregated count of records with same combination
    """
    errors = []
    entries = []
    
    # Process each record
    for record in records:
        row_number = record.source_row_number or record.ridership_record_id
        
        # Get fields from RidershipRecord model
        route_id = record.route_id or ''
        boarding_station_code = record.boarding_station_code or ''
        alighting_station_code = record.alighting_station_code or ''
        boarding_date = parse_datetime_to_yyyymmdd(record.boarding_at)
        
        # agency_id from operating_agency_code (not operating_agency_name)
        agency_id = record.operating_agency_code or ''
        
        # Validation
        if not route_id:
            errors.append({
                'row': row_number,
                'field': 'route_id',
                'message': 'route_id is required but missing'
            })
            continue
        
        if not boarding_station_code:
            errors.append({
                'row': row_number,
                'field': 'boarding_station_code',
                'message': 'boarding_station_code is required but missing'
            })
            continue
        
        if not alighting_station_code:
            errors.append({
                'row': row_number,
                'field': 'alighting_station_code',
                'message': 'alighting_station_code is required but missing'
            })
            continue
        
        if not boarding_date:
            errors.append({
                'row': row_number,
                'field': 'boarding_at',
                'message': 'boarding_at is required but missing or invalid'
            })
            continue
        
        # Add entry for aggregation
        entries.append({
            'date': boarding_date,
            'agency_id': agency_id,
            'route_id': route_id,
            'stopid_geton': boarding_station_code,
            'stopid_getoff': alighting_station_code
        })
    
    # Aggregate entries
    od_rows = aggregate_entries_to_od(entries)
    
    return od_rows, errors


def aggregate_entries_to_od(
    entries: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Aggregate OD entries by key fields.
    
    Aggregation key: (date, agency_id, route_id, stopid_geton, stopid_getoff)
    
    Args:
        entries: List of entry dicts
        
    Returns:
        List of aggregated OD rows with count
    """
    aggregated = defaultdict(int)
    
    for entry in entries:
        key = (
            entry['date'],
            entry['agency_id'],
            entry['route_id'],
            entry['stopid_geton'],
            entry['stopid_getoff']
        )
        aggregated[key] += 1
    
    # Build result rows
    od_rows = []
    for key, count in aggregated.items():
        od_rows.append({
            'date': key[0],
            'agency_id': key[1],
            'route_id': key[2],
            'stopid_geton': key[3],
            'stopid_getoff': key[4],
            'count': count
        })
    
    # Sort by date, route_id, stopid_geton, stopid_getoff
    od_rows.sort(key=lambda x: (
        x['date'],
        x['route_id'],
        x['stopid_geton'],
        x['stopid_getoff']
    ))
    
    return od_rows


def od_rows_to_csv(od_rows: List[Dict[str, Any]]) -> str:
    """Convert OD rows to CSV string."""
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow([
        'date', 'agency_id', 'route_id', 
        'stopid_geton', 'stopid_getoff', 'count'
    ])
    
    # Data
    for row in od_rows:
        writer.writerow([
            row['date'],
            row['agency_id'],
            row['route_id'],
            row['stopid_geton'],
            row['stopid_getoff'],
            row['count']
        ])
    
    return output.getvalue()