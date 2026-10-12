import { defineConfig, globalIgnores } from "eslint/config";

const eslintConfig = defineConfig([
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "node_modules/**"]),
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/stores/vendorStore",
              message: "VendorStore is retired in ride_prd. Use @tanstack/react-query + apiClient.GET('/v1/config/vendors') instead.",
            },
            {
              name: "@/stores/vehicleTypeStore",
              message: "VehicleTypeStore is retired in ride_prd. Use @tanstack/react-query + apiClient.GET('/v1/config/vehicle-types') instead.",
            },
            {
              name: "@/stores/vehicleStore",
              message: "VehicleStore is retired in ride_prd. Use @tanstack/react-query + apiClient.GET('/v1/fleet/vehicles') instead.",
            },
            {
              name: "@/stores/driverStore",
              message: "DriverStore is retired in ride_prd. Use @tanstack/react-query + apiClient.GET('/v1/fleet/drivers') instead.",
            },
            {
              name: "@/stores/tripStore",
              message: "tripStore is retired in ride_prd. Use @tanstack/react-query + apiClient trips endpoints instead.",
            },
            {
              name: "@/stores/billingStore",
              message: "billingStore is retired in ride_prd. Use @tanstack/react-query + apiClient billing endpoints instead.",
            },
            {
              name: "@/stores/earningsStore",
              message: "earningsStore is retired in ride_prd. Use @tanstack/react-query + apiClient billing endpoints instead.",
            },
            {
              name: "@/stores/payoutStore",
              message: "payoutStore is retired in ride_prd. Use @tanstack/react-query + apiClient /v1/billing/payouts instead.",
            },
            {
              name: "@/stores/alertStore",
              message: "alertStore trip slice is retired in ride_prd. Use @tanstack/react-query + apiClient trips endpoints instead.",
            },
          ],
          patterns: [
            {
              group: ["@ride/shared"],
              importNames: ["useCustomerStore", "useDriverStore", "useVehicleStore", "useVehicleTypeStore", "useTenantStore"],
              message: "This store is retired in ride_prd. Fetch from the API using @tanstack/react-query + apiClient instead.",
            },
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
