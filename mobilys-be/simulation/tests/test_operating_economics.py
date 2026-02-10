# simulation/tests/test_operating_economics_calc.py
from django.test import SimpleTestCase
import json
from decimal import Decimal, ROUND_HALF_UP

from simulation.models import Simulation, OperatingEconomics
from simulation.services.operating_economics_service import operating_economics_calc


class OperatingEconomicsCalcRealDBTest(SimpleTestCase):
    # allow DB (run with your custom NoDbTestRunner so it hits the real DB)
    databases = {"default"}

    def _round2(self, x: Decimal) -> Decimal:
        return x.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    def test_operating_economics_calc(self):
        # --- Adjust to an existing Simulation id in your DB ---
        simulation_id = 1
        sim = (
            Simulation.objects.select_related("original_scenario__user")
            .get(id=simulation_id)
        )
        user = sim.original_scenario.user

        # --------------------------
        # Input payload WITHOUT route_length_km & fare_yen
        # --------------------------
        test = [{
            "simulation": simulation_id,
            "route_id": "荏原循環(101_1_1)",
            "delta_trips_per_day": 20,     # trips/day
            "delta_users_per_day": 300,    # users/day
            "cost_per_vkm_yen": 520.90,    # yen per vehicle-km
        },
        {
            "simulation": simulation_id,
            "route_id": "運転教育・済生会病院線(104_1_1)",
            "delta_trips_per_day": 20,     # trips/day
            "delta_users_per_day": 300,    # users/day
            "cost_per_vkm_yen": 520.90,    # yen per vehicle-km
        },
        
        ]

        # --------------------- run util ---------------------
        for body in test:
            out = operating_economics_calc(body, user)

            print("\n=== OPERATING ECONOMICS RESULT ===")
            print(json.dumps(out, ensure_ascii=False, indent=2))

            # --------------------- structure checks ---------------------
            for key in (
                "simulation",
                "route_id",
                "route_length_km",
                "fare_yen",
                "cost_per_vkm_yen",
                "delta_trips_per_day",
                "delta_users_per_day",
                "delta_vehicle_km_per_day",
                "delta_cost_yen_per_day",
                "delta_revenue_yen_per_day",
                "net_per_day_yen",
                "annual_benefit_k_yen",
                "status",
            ):
                self.assertIn(key, out)

            # --------------------- expected values (derive from output for omitted inputs) ---------------------
            # Use returned route_length_km and fare_yen as the effective defaults chosen by the util
            rl = Decimal(str(out["route_length_km"]))
            fare = Decimal(str(out["fare_yen"]))
            cost_per_vkm = Decimal(str(out["cost_per_vkm_yen"]))

            trips = Decimal(str(body["delta_trips_per_day"]))
            users = Decimal(str(body["delta_users_per_day"]))

            delta_vehicle_km = rl * trips
            delta_cost_yen = self._round2(delta_vehicle_km * cost_per_vkm * Decimal("-1"))
            delta_revenue_yen = self._round2(users * fare)
            net_per_day_yen = self._round2(delta_revenue_yen + delta_cost_yen)
            annual_benefit_k_yen = self._round2(net_per_day_yen * Decimal("365") / Decimal("1000"))

            # --------------------- value checks ---------------------
            self.assertEqual(out["simulation"], sim.id)
            self.assertEqual(out["route_id"], body["route_id"])

            self.assertAlmostEqual(out["route_length_km"], float(rl))
            self.assertAlmostEqual(out["fare_yen"], float(fare))
            self.assertAlmostEqual(out["cost_per_vkm_yen"], float(cost_per_vkm))

            self.assertAlmostEqual(out["delta_trips_per_day"], float(trips))
            self.assertAlmostEqual(out["delta_users_per_day"], float(users))
            self.assertAlmostEqual(out["delta_vehicle_km_per_day"], float(delta_vehicle_km))
            self.assertAlmostEqual(out["delta_cost_yen_per_day"], float(delta_cost_yen))
            self.assertAlmostEqual(out["delta_revenue_yen_per_day"], float(delta_revenue_yen))
            self.assertAlmostEqual(out["net_per_day_yen"], float(net_per_day_yen))
            self.assertAlmostEqual(out["annual_benefit_k_yen"], float(annual_benefit_k_yen))

            self.assertEqual(out["status"], "success")

            # --------------------- DB persisted row check ---------------------
            ops = OperatingEconomics.objects.get(simulation=sim, route_id=body["route_id"])
            self.assertEqual(ops.route_length_km, rl)
            self.assertEqual(ops.cost_per_vkm_yen, cost_per_vkm)
            self.assertEqual(ops.delta_vehicle_km_per_day, delta_vehicle_km)
            self.assertEqual(ops.delta_cost_yen_per_day, delta_cost_yen)
            self.assertEqual(ops.delta_revenue_yen_per_day, delta_revenue_yen)
            self.assertEqual(ops.net_per_day_yen, net_per_day_yen)
            self.assertEqual(ops.annual_benefit_k_yen, annual_benefit_k_yen)
            self.assertEqual(ops.status, "success")

# docker exec -it mobilys_be python manage.py test simulation.tests --testrunner=mobilys_BE.core.test_runner.NoDbTestRunner
