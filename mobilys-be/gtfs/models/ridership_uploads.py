# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
import uuid

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.postgres.fields import ArrayField
from django.db import models

from gtfs.constants import RidershipUploadStatus, RidershipErrorType
from .scenario import Scenario

class RidershipUpload(models.Model):
    """
    乗降実績アップロード（ヘッダーテーブル）
    Excelファイルのアップロードトランザクションを記録するモデル
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    scenario = models.ForeignKey(Scenario, on_delete=models.CASCADE)
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        help_text="User who uploaded the file"
    )
    
    # User-defined name/label for this upload
    ridership_record_name = models.CharField(
        max_length=255,
        help_text="User-defined name/label to identify this ridership data upload"
    )
    
    # File information
    file_name = models.CharField(
        max_length=255,
        help_text="Original filename of the uploaded Excel file"
    )
    file_size = models.BigIntegerField(
        null=True,
        blank=True,
        help_text="File size in bytes"
    )
    
    # Upload metadata
    upload_status = models.CharField(
        max_length=20,
        choices=RidershipUploadStatus.choices(),
        default=RidershipUploadStatus.PENDING.value,
        help_text="Current status of the upload processing"
    )
    
    # Row counts
    total_rows = models.IntegerField(
        default=0,
        help_text="Total number of rows in the uploaded file"
    )
    success_rows = models.IntegerField(
        default=0,
        help_text="Number of successfully imported rows"
    )
    
    # Optional description/notes
    description = models.TextField(
        blank=True,
        help_text="Optional description or notes about this upload"
    )

    # Max tolerance time for data processing
    max_tolerance_time = models.IntegerField(
        null=True,
        blank=True,
        help_text="Maximum tolerance time in minutes for ridership data processing"
    )
    
    # Timestamps
    uploaded_at = models.DateTimeField(
        auto_now_add=True,
        help_text="Timestamp when the file was uploaded"
    )
    processed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Timestamp when processing was completed"
    )
    created_datetime = models.DateTimeField(auto_now_add=True)
    updated_datetime = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'ridership_uploads'
        ordering = ['-uploaded_at']
        indexes = [
            models.Index(fields=['scenario', 'uploaded_at']),
            models.Index(fields=['user', 'uploaded_at']),
            models.Index(fields=['upload_status']),
        ]

    def __str__(self):
        return f"{self.ridership_record_name} - {self.file_name} ({self.uploaded_at.strftime('%Y-%m-%d %H:%M')})"

class RidershipUploadError(models.Model):
    """
    乗降実績アップロードエラー
    アップロード時にエラーとなったレコードを記録するモデル
    """

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    
    ridership_upload = models.ForeignKey(
        RidershipUpload,
        on_delete=models.CASCADE,
        related_name='errors',
        help_text="Reference to the upload transaction this error belongs to"
    )
    
    # Location in original file
    source_row_number = models.IntegerField(
        help_text="Row number in the original Excel file where the error occurred"
    )
    
    # Error classification
    error_type = models.CharField(
        max_length=50,
        choices=RidershipErrorType.choices(),
        default=RidershipErrorType.UNKNOWN.value,
        help_text="Type/category of the error"
    )
    
    # Error details
    field_name = models.CharField(
        max_length=200,
        blank=True,
        help_text="Name of the field that caused the error (if applicable)"
    )
    
    error_message = models.TextField(
        help_text="Detailed error message"
    )
    
    # Raw data that failed (store original row data for reference/retry)
    raw_data = models.JSONField(
        null=True,
        blank=True,
        help_text="Original row data from the Excel file that failed to import"
    )
    
    created_datetime = models.DateTimeField(auto_now_add=True)

    # Optional description/notes
    description = models.TextField(
        blank=True,
        help_text="Optional description or notes about this error"
    )


    class Meta:
        db_table = 'ridership_upload_errors'
        ordering = ['source_row_number']
        indexes = [
            models.Index(fields=['ridership_upload', 'source_row_number']),
            models.Index(fields=['ridership_upload', 'error_type']),
        ]

    def __str__(self):
        return f"Row {self.source_row_number}: [{self.error_type}] {self.error_message[:50]}..."
