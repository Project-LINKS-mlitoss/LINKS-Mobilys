export const SIMULATION_CSV_TEMPLATE = `date,agency_id,route_id,trip_id,stop_id,stop_sequence,count_geton,count_getoff
20240401,Agency A,Route A,Trip A,Stop 1,1,5,0
20240401,Agency A,Route A,Trip A,Stop 2,12,5,0
20240401,Agency A,Route A,Trip A,Stop 3,16,0,1
20240401,Agency A,Route A,Trip A,Stop 4,19,0,2
20240401,Agency A,Route A,Trip A,Stop 5,20,0,2
`;

export const SIMULATION_DEFAULT_PARAMS = {
  serviceDate: "",
  serviceIds: [],
  epsilon_inc: 0.5,
  epsilon_dec: 0.5,
  costPerShare: 520.9,
  carShare: 0.58,
  timeValueYenPerMin_perVehicle: 48.89,
  defaultFare: 200,
};

