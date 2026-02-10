# simulation/tests/test_speed_time_nested_real.py
from django.test import SimpleTestCase
import json
from simulation.models import Simulation
from simulation.services.travel_speed_changes_service import (
    compute_speed_time_nested_response,
    travel_speed_calc,
)

class SpeedTimeNestedRealDBTest(SimpleTestCase):

    databases = {"default"}

    def test_print_real_values(self):

        self.simulation = 1
        self.data4_payload = {
            "car_change_number": 45,
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
                                    "length_m": 1000,
                                    "traffic24_total": 15470,
                                    "before_cars_per_day": 15470,
                                    "after_cars_per_day": 15425,
                                    "before_vehicle_km_per_day": 15470,
                                    "after_vehicle_km_per_day": 15425,
                                },
                                {
                                    "matchcode_shp": "553701-0106201063",
                                    "section_code_csv": "16300410230",
                                    "road_name": "一般国道４１号",
                                    "length_m": 300,
                                    "traffic24_total": 26017,
                                    "before_cars_per_day": 26017.0,
                                    "after_cars_per_day": 25972.0,
                                    "before_vehicle_km_per_day": 7805.0,
                                    "after_vehicle_km_per_day": 7791.0,
                                },
                            ],
                        }
                    ],
                },
               {
                    "route_id": "運転教育・済生会病院線(104_1_1)",
                    "shapes": [
                        {
                            "shape_id": "104_1_1",
                            "segments": [
                                {
                                    "matchcode_shp": "553701-0017601726",
                                    "section_code_csv": "16400220010",
                                    "road_name": "主要地方道富山停車場線",
                                    "length_m": 275,
                                    "lanes": 2,
                                    "updown_cd": 3,
                                    "speed_code": 2,
                                    "access_cd": 0,
                                    "toll_cd": 2,
                                    "motor_only_cd": 2,
                                    "travel_speed_model_kmh": 10.8,
                                    "speed_up_kmh": 13.6,
                                    "speed_dn_kmh": 11.1,
                                    "vol_up_24h": 7135,
                                    "vol_dn_24h": 8335,
                                    "traffic24_total": 15470,
                                    "vol_up_12h": 5483,
                                    "vol_dn_12h": 6326,
                                    "traffic12_total": 11809,
                                    "signal_density_per_km": 6.0,
                                    "congestion_index": 1.37,
                                    "before_cars_per_day": 15470.0,
                                    "delta_cars_per_day": 1.6385130697491133,
                                    "after_cars_per_day": 15471.638513069749,
                                    "before_vehicle_km_per_day": 4254.25,
                                    "after_vehicle_km_per_day": 4254.700591094182,
                                    "delta_vehicle_km_per_day": 0.45059109418161825
                                },
                            ]
                        }
                    ]
                },

            ],
        }
        self.sim = (
            Simulation.objects.select_related("original_scenario__user")
            .get(id=self.simulation)
        )        
        self.user = self.sim.original_scenario.user
        # result = compute_speed_time_nested_response(data4_payload)
        result = travel_speed_calc(self.simulation, self.data4_payload, self.user)
        print("\n=== REAL RESULT ===")
        print(json.dumps(result, ensure_ascii=False, indent=2))

        # Structure checks
        self.assertIn("routes", result)
        self.assertGreater(len(result["routes"]), 0)

        seg = result["routes"][0]["shapes"][0]["segments"][0]
        metrics = seg["metrics"]

        for key in ("speed_kmh", "time_per_vehicle_h", "total_time_vehicle_h", "vehicle_km_per_day"):
            self.assertIn(key, metrics)
            self.assertIn("before", metrics[key])
            self.assertIn("after", metrics[key])

        # Speeds should be numbers; don’t pin exact values in a real-DB test
        self.assertIsInstance(metrics["speed_kmh"]["before"], (int, float))
        self.assertIsInstance(metrics["speed_kmh"]["after"],  (int, float))

# How to test
# update the simulation and data4_payload values
# Run: docker exec -it mobilys_be python manage.py test simulation.tests --testrunner=mobilys_BE.core.test_runner.NoDbTestRunner
