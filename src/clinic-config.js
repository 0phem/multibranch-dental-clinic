// Public presentation data only; never used for M2 authorization or scheduling.
// Names/addresses supplied by the client. Map pins checked against public place records.
// See docs/PUBLIC_AUTH_LOCATIONS_REFINEMENT.md for verification evidence.
export const clinic = Object.freeze({
  name: 'Dr. Dana E. Roxas Dental Clinic',
  nameLine: 'Dr. Dana E. Roxas',
  subtitle: 'Dental Clinic',
  locationLabel: 'Dr. Dana E. Roxas Dental Clinic - Bocaue, Bulacan',
  city: 'Bocaue, Bulacan',
  phoneDisplay: '0922 878 7341',
  phoneE164: '+639228787341',
  email: 'danaroxas.dentalclinic@gmail.com',
  logo: '/images/logo.png',
  branches: Object.freeze([
    Object.freeze({
      id: 'bocaue-37', number: '01',
      name: 'Dr. Dana Roxas Dental Clinic',
      address: '#37, MacArthur Hwy, Bocaue, 3018 Bulacan',
      latitude: 14.800254, longitude: 120.9233274,
      source: 'https://www.google.com/maps?cid=15251005469195418416',
    }),
    Object.freeze({
      id: 'bocaue-cardinal', number: '02',
      name: 'Roxas - Cardinal Dental Center',
      address: '67 MacArthur Hwy, Wakas, Bocaue, 3018 Bulacan',
      latitude: 14.7996762, longitude: 120.9234564,
      source: 'https://www.google.com/maps?cid=166116950672724786',
    }),
    Object.freeze({
      id: 'guiguinto-gd-plaza', number: '03',
      name: 'Roxas Dental Clinic Guiguinto',
      address: 'Unit 20 GD Plaza, Guiguinto, Bulacan',
      latitude: 14.8284409, longitude: 120.8745988,
      source: 'https://www.google.com/maps?cid=9281875676794275970',
    }),
  ]),
})
