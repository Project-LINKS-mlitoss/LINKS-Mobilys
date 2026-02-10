import logging
from dataclasses import dataclass
from io import BytesIO
from typing import Optional

import requests

from gtfs.utils.gtfs_safe_notices_utils import get_safe_notice_registry
from gtfs.services.base import log_service_call
from ..models import Scenario, GtfsValidationResult
from ..utils.scenario_utils import generate_gtfs_zip_export
from ..constants.config import GTFS_VALIDATOR_TIMEOUT_SECONDS, GTFS_VALIDATOR_URL

logger = logging.getLogger(__name__)

VALIDATOR_URL = GTFS_VALIDATOR_URL
VALIDATOR_TIMEOUT = GTFS_VALIDATOR_TIMEOUT_SECONDS


@dataclass
class ClassifiedNotice:
    """A notice with its classification status."""
    notice: dict
    is_safe: bool
    safe_reason_ja: Optional[str] = None
    safe_reason_en: Optional[str] = None
    reason_ja: Optional[str] = None
    reason_en: Optional[str] = None
    skip: bool = False
    is_fixable: bool = False
    
    def to_dict(self) -> dict:
        result = {
            **self.notice,
            'is_safe': self.is_safe,
            'skip': self.skip,
            'is_fixable': self.is_fixable,
        }
        if self.reason_ja is not None:
            result['reason_ja'] = self.reason_ja
        if self.reason_en is not None:
            result['reason_en'] = self.reason_en
        if self.is_safe:
            result['safe_reason_ja'] = self.safe_reason_ja
            result['safe_reason_en'] = self.safe_reason_en
        return result
    

@log_service_call
class GtfsValidatorService:
    """
    Service for validating GTFS data using external MobilityData GTFS Validator.
    """

    @staticmethod
    def validate_scenario(scenario: Scenario) -> GtfsValidationResult:
        """
        Validate GTFS for an existing scenario and store classified result in DB.
        """
        zip_buffer = generate_gtfs_zip_export(scenario.id)
        zip_buffer.seek(0)
        
        response_data = GtfsValidatorService.call_validator(zip_buffer)
        raw_notices = GtfsValidatorService.extract_notices(response_data)
        
        # Classify and convert to dicts for JSON storage
        classified = GtfsValidatorService.classify_notices(raw_notices)
        classified_dicts = [cn.to_dict() for cn in classified]
    
        result, _ = GtfsValidationResult.objects.update_or_create(
            scenario=scenario,
            defaults={
                'notices': classified_dicts,
                'validator_version': response_data.get('summary', {}).get('validatorVersion', ''),
            }
        )
        
        return result
    
    @staticmethod
    def validate_zip_file(zip_file) -> dict:
        if hasattr(zip_file, 'seek'):
            zip_file.seek(0)
        
        if hasattr(zip_file, 'read'):
            content = zip_file.read()
            zip_buffer = BytesIO(content)
            if hasattr(zip_file, 'seek'):
                zip_file.seek(0)
        else:
            zip_buffer = zip_file
        
        zip_buffer.seek(0)
        response_data = GtfsValidatorService.call_validator(zip_buffer)
        raw_notices = GtfsValidatorService.extract_notices(response_data)
        
        classified = GtfsValidatorService.classify_notices(raw_notices)
        classified_dicts = [cn.to_dict() for cn in classified]
        
        # Calculate summary
        summary = GtfsValidatorService.calculate_summary(classified_dicts)
        
        return {
            # Fixable notices should not block import; only non-safe ERRORs block.
            'has_blocking_errors': summary['blocking_error_count'] > 0,
            'validation_response': response_data,
            'classified_notices': classified_dicts,
            **summary,
        }
    
    @staticmethod
    def call_validator(zip_buffer: BytesIO) -> dict:
        """
        Call external GTFS validator API.
        """
        files = {
            'file': ('gtfs.zip', zip_buffer, 'application/zip')
        }
        response = requests.post(
            VALIDATOR_URL,
            files=files,
            timeout=VALIDATOR_TIMEOUT
        )
        
        response.raise_for_status()
        return response.json()
    
    @staticmethod
    def extract_notices(response_data: dict) -> list:
        if 'notices' not in response_data:
            raise ValueError("Invalid validator response: missing 'notices' field")
        
        return response_data['notices']
    
    
    @staticmethod
    def format_error_response(validation_result: dict) -> dict:
        """Format validation result for error response to FE."""
        response_data = validation_result['validation_response']
        classified = validation_result['classified_notices']
        
        blocking_errors = []
        safe_notices = []
        fixable_notices = []
        warnings = []
        infos = []
        
        for n in classified:
            if n.get('skip', False):
                continue

            severity = n.get('severity', '')
            is_safe = n.get('is_safe', False)
            is_fixable = n.get('is_fixable', False)

            if severity == 'ERROR' and is_fixable:
                fixable_notices.append(n)
            elif is_safe:
                safe_notices.append(n)
            elif severity == 'ERROR':
                blocking_errors.append(n)
            elif severity == 'WARNING':
                warnings.append(n)
            elif severity == 'INFO':
                infos.append(n)
        
        return {
            'summary': response_data.get('summary', {}),
            'blocking_errors': blocking_errors,
            'safe_notices': safe_notices,
            'fixable_notices': fixable_notices,
            'warnings': warnings,
            'infos': infos,
            'blocking_error_count': len(blocking_errors),
            'safe_notice_count': len(safe_notices),
            'fixable_notice_count': len(fixable_notices),
            'warning_count': len(warnings),
            'info_count': len(infos),
        }
    
    @staticmethod
    def classify_notices(notices: list) -> list[ClassifiedNotice]:
        """
        Classify notices as safe, blocking, or skipped.
        
        For notices like duplicate_key that can have samples from multiple files,
        we split them into separate notices - one safe, one blocking.
        
        Notices with skip=True are excluded from all counts and displays.
        """
        registry = get_safe_notice_registry()
        classified = []
        
        for notice in notices:
            code = notice.get('code', '')
            is_fixable = False
            fixable_rule = None
            if notice.get("severity") == "ERROR":
                is_fixable, fixable_rule = registry.is_fixable_notice(notice)
            
            # Check if this notice needs splitting (has allowed_filenames rule)
            rule = registry.get_splittable_rule(code)
            
            if rule and rule.allowed_filenames:
                # Split samples into safe and unsafe groups
                safe_samples, unsafe_samples = GtfsValidatorService.split_samples_by_allowed_files(
                    notice.get('sampleNotices', []),
                    rule.allowed_filenames
                )
                
                # Create safe notice (if has safe samples)
                if safe_samples:
                    safe_notice = {
                        **notice,
                        'sampleNotices': safe_samples,
                        'totalNotices': len(safe_samples),
                    }
                    classified.append(ClassifiedNotice(
                        notice=safe_notice,
                        is_safe=True,
                        safe_reason_ja=rule.reason_ja,
                        safe_reason_en=rule.reason_en,
                        reason_ja=rule.reason_ja,
                        reason_en=rule.reason_en,
                        skip=rule.skip,
                        is_fixable=is_fixable,
                    ))
                
                # Create blocking notice (if has unsafe samples)
                if unsafe_samples:
                    unsafe_notice = {
                        **notice,
                        'sampleNotices': unsafe_samples,
                        'totalNotices': len(unsafe_samples),
                    }
                    classified.append(ClassifiedNotice(
                        notice=unsafe_notice,
                        is_safe=False,
                        safe_reason_ja=None,
                        safe_reason_en=None,
                        reason_ja=fixable_rule.reason_ja if fixable_rule else None,
                        reason_en=fixable_rule.reason_en if fixable_rule else None,
                        skip=False,
                        is_fixable=is_fixable,
                    ))
            else:
                # Standard classification (no splitting)
                is_safe, matched_rule = registry.is_safe_notice(notice)
                
                classified.append(ClassifiedNotice(
                    notice=notice,
                    is_safe=is_safe,
                    safe_reason_ja=matched_rule.reason_ja if matched_rule else None,
                    safe_reason_en=matched_rule.reason_en if matched_rule else None,
                    reason_ja=(
                        fixable_rule.reason_ja
                        if fixable_rule
                        else (matched_rule.reason_ja if matched_rule else None)
                    ),
                    reason_en=(
                        fixable_rule.reason_en
                        if fixable_rule
                        else (matched_rule.reason_en if matched_rule else None)
                    ),
                    skip=matched_rule.skip if matched_rule else False,
                    is_fixable=is_fixable,
                ))
        
        return classified


    @staticmethod
    def split_samples_by_allowed_files(
        samples: list[dict],
        allowed_filenames: frozenset[str],
    ) -> tuple[list[dict], list[dict]]:
        safe_samples: list[dict] = []
        unsafe_samples: list[dict] = []

        for sample in samples:
            filename = sample.get("filename", "")
            if filename in allowed_filenames:
                safe_samples.append(sample)
            else:
                unsafe_samples.append(sample)

        return safe_samples, unsafe_samples
    
    @staticmethod
    def calculate_summary(classified_notices: list[dict]) -> dict:
        blocking_error_count = 0
        safe_notice_count = 0
        fixable_notice_count = 0
        warning_count = 0
        info_count = 0
        skipped_count = 0
        
        for notice in classified_notices:
            if notice.get('skip', False):
                skipped_count += 1
                continue
            
            severity = notice.get('severity', '')
            is_safe = notice.get('is_safe', False)
            is_fixable = notice.get('is_fixable', False)
            
            if severity == 'ERROR' and is_fixable:
                fixable_notice_count += 1
            elif is_safe:
                safe_notice_count += 1
            elif severity == 'ERROR':
                blocking_error_count += 1
            elif severity == 'WARNING':
                warning_count += 1
            elif severity == 'INFO':
                info_count += 1
        
        return {
            'blocking_error_count': blocking_error_count,
            'safe_notice_count': safe_notice_count,
            'fixable_notice_count': fixable_notice_count,
            'warning_count': warning_count,
            'info_count': info_count,
            'skipped_count': skipped_count,
        }
