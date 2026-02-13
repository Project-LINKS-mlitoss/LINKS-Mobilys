# Copyright (c) 2025-2026 MLIT Japan
# SPDX-License-Identifier: MIT
import uuid

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.postgres.fields import ArrayField
from django.db import models

from gtfs.constants import (
    ICCardFeatureType,
    OperationDetailType,
    OperationType,
    PassengerClassificationType,
    TicketType,
)
from .scenario import Scenario
from .ridership_uploads import RidershipUpload


class RidershipRecord(models.Model):
    """
    乗降実績（1件明細データ）
    ICカード利用による乗降実績を記録するモデル
    Based on: 1件明細のデータ変換.xlsx - Sheet4
    """
    
    scenario = models.ForeignKey(Scenario, on_delete=models.CASCADE)
    
    # FK to header table
    ridership_upload = models.ForeignKey(
        RidershipUpload,
        on_delete=models.CASCADE,
        related_name='records',
        help_text="Reference to the upload transaction this record belongs to",
        default=None,
        null=True
    )
    
    # Row number in the original file (for error tracking)
    source_row_number = models.IntegerField(
        null=True,
        blank=True,
        help_text="Original row number in the uploaded Excel file"
    )

    # 1. ICカード識別コード (Required)
    ic_card_agency_identification_code = models.CharField(
        max_length=200,
        help_text="事業会社が管理するICカードの識別番号IDiまたはカードの製造番号IDmを設定する"
    )
    
    # 2. ICカード発行事業者コード
    ic_card_issuer_code = models.CharField(
        max_length=200,
        blank=True,
        help_text="ICカードの発行事業者を識別するコード"
    )
    
    # 3. ICカード発行事業者名
    ic_card_issuer_name = models.CharField(
        max_length=200,
        blank=True,
        help_text="ICカードの発行事業者名"
    )
    
    # 4. ICカード機能区分
    ic_card_feature_type = models.CharField(
        max_length=50,
        blank=True,
        choices=ICCardFeatureType.choices(),
        help_text="ICカードに付帯されている機能を識別するコード"
    )
    
    # 5. 券種エリアコード
    ticket_type_area_code = models.CharField(
        max_length=200,
        blank=True,
        help_text="定期券などの対象となるエリアを識別するコード。ICカードに券種が存在する場合に設定"
    )
    
    # 6. 券種区分
    ticket_type = models.CharField(
        max_length=50,
        blank=True,
        choices=TicketType.choices(),
        help_text="チケットに付帯している券種を識別するコード"
    )
    
    # 7. 券種名
    ticket_type_name = models.CharField(
        max_length=200,
        blank=True,
        help_text="チケットに付帯している券種名"
    )
    
    # 8. 券有効開始日
    ticket_valid_start_date = models.DateField(
        null=True,
        blank=True,
        help_text="定期券等ICカードを特有の券種として利用している場合の有効開始日"
    )
    
    # 9. 券有効終了日
    ticket_valid_end_date = models.DateField(
        null=True,
        blank=True,
        help_text="定期券等ICカードを特有の券種として利用している場合の有効終了日"
    )
    
    # 10. 乗降実績ID (Required)
    ridership_record_id = models.IntegerField(
        help_text="システムが明細を管理するための一意のID"
    )
    
    # 11. 交通モードコード
    transportation_mode_code = models.CharField(
        max_length=200,
        blank=True,
        help_text="利用した交通モードを識別するコード。GTFSを利用する場合、routes.txtの「route_type」を設定する"
    )
    
    # 12. ICカード利用明細ID
    ic_card_usage_detail_id = models.IntegerField(
        null=True,
        blank=True,
        help_text="ICカードが保持している一意のID。IDi、IDm単位の管理明細ID"
    )
    
    # 13. 運行事業者コード
    operating_agency_code = models.CharField(
        max_length=200,
        blank=True,
        help_text="運行事業者を識別するためのコード。GTFSを利用する場合、agency.txtの「agency_id」を設定"
    )
    
    # 14. 運行事業者名
    operating_agency_name = models.CharField(
        max_length=200,
        blank=True,
        help_text="運行事業者名"
    )
    
    # 15. 営業所コード
    serviced_office_code = models.CharField(
        max_length=200,
        blank=True,
        help_text="営業所を識別するためのコード。GTFSを利用する場合、office_jp.txtの「office_id」を設定"
    )
    
    # 16. 営業所名
    serviced_office_name = models.CharField(
        max_length=200,
        blank=True,
        help_text="営業所名。GTFSを利用する場合、office_jp.txtの「office_name」を設定"
    )
    
    # 17. 系統ID
    route_pattern_id = models.CharField(
        max_length=200,
        blank=True,
        help_text="系統を識別するためのコード。GTFSを利用する場合、pattern_jp.txtの「jp_pattern_id」を設定する"
    )
    
    # 18. 系統番号
    route_pattern_number = models.CharField(
        max_length=200,
        blank=True,
        help_text="バス事業者が系統の識別のために独自に定めている番号や記号。GTFSを利用する場合、routes.txtの「route_short_name」を設定"
    )
    
    # 19. 路線名
    service_line_name = models.CharField(
        max_length=200,
        blank=True,
        help_text="バス事業者が路線の識別のために独自に定めている番号や記号"
    )
    
    # 20. 経路ID
    route_id = models.CharField(
        max_length=200,
        blank=True,
        help_text="経路を識別するためのコード。GTFSを利用する場合、routes.txtの「route_id」を設定する"
    )
    
    # 21. 経路名
    route_name = models.CharField(
        max_length=200,
        blank=True,
        help_text="経路名。GTFSを利用する場合、routes.txtの「route_long_name」を設定する"
    )
    
    # 22. 便コード
    trip_code = models.CharField(
        max_length=200,
        blank=True,
        help_text="路線・系統における便を識別するコード。GTFSを利用する場合、trips.txtの「trip_id」を設定する"
    )
    
    # 23. ダイヤ番号
    timetable_number = models.CharField(
        max_length=200,
        blank=True,
        help_text="バス事業者内部で使われる運行計画の識別番号"
    )
    
    # 24. 車両番号
    vehicle_number = models.CharField(
        max_length=200,
        blank=True,
        help_text="それぞれのバス会社が独自に付与している識別番号"
    )
    
    # 25. 処理区分
    operation_type = models.CharField(
        max_length=50,
        blank=True,
        choices=OperationType.choices(),
        help_text="乗降実績に関連する処理を識別するコード"
    )
    
    # 26. 処理詳細区分
    operation_detail_type = models.CharField(
        max_length=50,
        blank=True,
        choices=OperationDetailType.choices(),
        help_text="処理コードを参照しつつ、より細分化された情報を管理する"
    )
    
    # 27. 乗車エリアコード
    boarding_area_code = models.CharField(
        max_length=200,
        blank=True,
        help_text="乗車駅(停留所)の地域を識別するためのコード"
    )
    
    # 28. 乗車停留所連番
    boarding_station_sequence = models.IntegerField(
        null=True,
        blank=True,
        help_text="同一系統内で同じ停留所に複数回停車する場合、何回目の停車かを識別するための連番"
    )
    
    # 29. 乗車駅(停留所)コード (Required)
    boarding_station_code = models.CharField(
        max_length=200,
        help_text="乗車した駅(停留所)を識別するコード。GTFSを利用する場合、stops.txtの「stop_id」を設定する"
    )
    
    # 30. 乗車駅(停留所)名
    boarding_station_name = models.CharField(
        max_length=200,
        blank=True,
        help_text="乗車した駅(停留所)名。GTFSを利用する場合、stops.txtの「stop_name」を設定する"
    )
    
    # 31. 乗車日時
    boarding_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="乗車した日時"
    )
    
    # 32. 乗継エリアコードリスト
    transfer_area_code_list = ArrayField(
        base_field=models.CharField(max_length=200),
        default=list,
        blank=True,
        help_text="乗継駅(停留所)の地域を識別するためのコードのリスト"
    )
    
    # 33. 乗継駅(停留所)コードリスト
    transfer_station_code_list = ArrayField(
        base_field=models.CharField(max_length=200),
        default=list,
        blank=True,
        help_text="乗継駅がある場合に、利用した駅(停留所)を識別するコードのリスト。GTFSを利用する場合、stops.txtの「stop_id」を設定する"
    )
    
    # 34. 降車エリアコード
    alighting_area_code = models.CharField(
        max_length=200,
        blank=True,
        help_text="降車駅(停留所)の地域を識別するためのコード"
    )
    
    # 35. 降車停留所連番
    alighting_station_sequence = models.IntegerField(
        null=True,
        blank=True,
        help_text="同一系統内で同じ停留所に複数回停車する場合、何回目の停車かを識別するための連番"
    )
    
    # 36. 降車駅(停留所)コード (Required)
    alighting_station_code = models.CharField(
        max_length=200,
        help_text="降車した駅(停留所)を識別するコード。GTFSを利用する場合、stops.txtの「stop_id」を設定する"
    )
    
    # 37. 降車駅(停留所)名
    alighting_station_name = models.CharField(
        max_length=200,
        blank=True,
        help_text="降車した駅(停留所)名。GTFSを利用する場合、stops.txtの「stop_name」を設定する"
    )
    
    # 38. 降車日時
    alighting_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="降車した日時"
    )
    
    # 39. 精算日時 (Required)
    payment_at = models.DateTimeField(
        help_text="精算日時。一件明細が作成された日時(鉄道であれば出場、バスであれば乗車もしくは降車の精算時)"
    )
    
    # 40. 大人障がい者利用者数
    adult_challenged_passenger_count = models.IntegerField(
        null=True,
        blank=True,
        help_text="大人身障者利用人数"
    )
    
    # 41. 大人利用者数
    adult_passenger_count = models.IntegerField(
        null=True,
        blank=True,
        help_text="大人利用人数"
    )
    
    # 42. 小児障がい者利用者数
    child_challenged_passenger_count = models.IntegerField(
        null=True,
        blank=True,
        help_text="小児身障者利用人数"
    )
    
    # 43. 小児利用者数
    child_passenger_count = models.IntegerField(
        null=True,
        blank=True,
        help_text="小児利用人数"
    )
    
    # 44. 利用者分類区分
    passenger_classification_type = models.CharField(
        max_length=50,
        blank=True,
        choices=PassengerClassificationType.choices(),
        help_text="利用者の分類を識別するコード"
    )

    created_datetime = models.DateTimeField(auto_now_add=True)
    updated_datetime = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'ridership_records'
        constraints = [
            models.UniqueConstraint(
                fields=['ridership_upload', 'ridership_record_id'],
                name='unique_ridership_record_per_upload'
            )
        ]
        indexes = [
            models.Index(fields=['scenario', 'payment_at']),
            models.Index(fields=['scenario', 'boarding_station_code']),
            models.Index(fields=['scenario', 'alighting_station_code']),
            models.Index(fields=['scenario', 'ic_card_agency_identification_code']),
            models.Index(fields=['ridership_upload', 'source_row_number']),
        ]

    def __str__(self):
        return f"Ridership {self.ridership_record_id}: {self.boarding_station_code} -> {self.alighting_station_code}"
