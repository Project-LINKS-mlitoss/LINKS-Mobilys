
from django.test import SimpleTestCase
import json
from simulation.services.benefit_calculations_service import compute_benefits_from_payload

class OpUnitBenefitsRealDBTest(SimpleTestCase):
    databases = {"default"}

    def test_benefits_on_real_db(self):
        payload = {
                    "simulation": "1",
                    "car_change_number": 45.0,
                    "service_id": "平日",
                    "routes": [
                        {
                        "route_id": "フィーダー四方(601_1)",
                        "shapes": [
                            {
                            "shape_id": "601_1",
                            "direction_id": "1",
                            "segments": [
                                {
                                "matchcode_shp": "553701-0057200576",
                                "section_code_csv": "16400220010",
                                "road_name": "主要地方道富山停車場線",
                                "metrics": {
                                    "speed_kmh": {
                                    "before": 9.8,
                                    "after": 10.0
                                    },
                                    "time_per_vehicle_h": {
                                    "before": 0.1,
                                    "after": 0.1
                                    },
                                    "total_time_vehicle_h": {
                                    "before": 1579.0,
                                    "after": 1536.0
                                    },
                                    "vehicle_km_per_day": {
                                    "before": 15470.0,
                                    "after": 15425.0
                                    }
                                }
                                },
                                {
                                "matchcode_shp": "553701-0106201063",
                                "section_code_csv": "16300410230",
                                "road_name": "一般国道４１号",
                                "metrics": {
                                    "speed_kmh": {
                                    "before": 12.2,
                                    "after": 12.3
                                    },
                                    "time_per_vehicle_h": {
                                    "before": 0.02,
                                    "after": 0.02
                                    },
                                    "total_time_vehicle_h": {
                                    "before": 640.0,
                                    "after": 631.0
                                    },
                                    "vehicle_km_per_day": {
                                    "before": 7805.0,
                                    "after": 7791.0
                                    }
                                }
                                }
                            ]
                            }
                        ]
                        }
                    ]
                    }

        # AH49 (円/分・台)
        ah49 = 49.06

        result = compute_benefits_from_payload(
            payload=payload,
            time_value_unit_yen_per_minute_per_vehicle=ah49,
        )

        print("\n=== BENEFITS RESULT ===")
        print(json.dumps(result, ensure_ascii=False, indent=2))

        # Basic structure checks
        self.assertIn("routes", result)
        self.assertGreater(len(result["routes"]), 0)

        segs = result["routes"][0]["shapes"][0]["segments"]
        self.assertGreater(len(segs), 0)

        # Verify the six outputs (3 groups × before/after) exist and are numeric
        for seg in segs:
            self.assertIn("metrics", seg)
            m = seg["metrics"]

            # Group 1: 走行時間短縮便益の算出
            self.assertIn("travel_time_savings_benefit_yen_per_day", m)
            g1 = m["travel_time_savings_benefit_yen_per_day"]
            self.assertIn("before", g1)
            self.assertIn("after", g1)
            self.assertIsInstance(g1["before"], (int, float))
            self.assertIsInstance(g1["after"], (int, float))

            # Group 2: 走行経費減少便益の算出
            self.assertIn("operating_cost_reduction_benefit_yen_per_day", m)
            g2 = m["operating_cost_reduction_benefit_yen_per_day"]
            self.assertIn("before", g2)
            self.assertIn("after", g2)
            self.assertIsInstance(g2["before"], (int, float))
            self.assertIsInstance(g2["after"], (int, float))

            # Group 3: 交通事故減少便益の算出
            self.assertIn("traffic_accident_reduction_benefit_yen_per_year", m)
            g3 = m["traffic_accident_reduction_benefit_yen_per_year"]
            self.assertIn("before", g3)
            self.assertIn("after", g3)
            self.assertIsInstance(g3["before"], (int, float))
            self.assertIsInstance(g3["after"], (int, float))



# How to test
# update the payload and ah49 values
# Run: docker exec -it mobilys_be python manage.py test simulation.tests --testrunner=mobilys_BE.core.test_runner.NoDbTestRunner
