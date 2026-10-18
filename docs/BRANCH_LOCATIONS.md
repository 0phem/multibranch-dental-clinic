# Branch names, addresses and coordinates

Source of the names and addresses: given by the clinic owner's team on 2026-10-14 (task "real branches"). They replace the
placeholder names "Branch A/B/C" everywhere. In the code they live in one place: `backend/database/seeders/RealBranchSeeder.php`
(`REAL`). The Owner can change every branch detail in Administration → Branches.

| Ref | Name (displayed) | Address (exactly as given) | Latitude | Longitude | Public source of the coordinates |
| --- | --- | --- | --- | --- | --- |
| b1 | Dr. Dana Roxas Dental Clinic | #37, MacArthur Hwy, Bocaue, 3018 Bulacan | 14.800254 | 120.9233274 | [Google Maps place record](https://www.google.com/maps?cid=15251005469195418416) |
| b2 | Roxas - Cardinal Dental Center | 67 MacArthur Hwy, Wakas, Bocaue, 3018 Bulacan | 14.7996762 | 120.9234564 | [Google Maps place record](https://www.google.com/maps?cid=166116950672724786) |
| b3 | Roxas Dental Clinic Guiguinto | Unit 20 GD Plaza, Guiguinto, Bulacan | 14.8284409 | 120.8745988 | [Google Maps place record](https://www.google.com/maps?cid=9281875676794275970) |

- The coordinates were read from those public place records, whose name and address matched the clinic's; see
  `docs/PUBLIC_AUTH_LOCATIONS_REFINEMENT.md` items 10–12 for how they were checked. They are **approximate** and are used only
  to sort branches by distance in booking. A Patient's location is used once in the browser request and never stored.
- If a branch has no coordinates, booking ranks branches by the earliest open time instead (no guessing).
- **Open item:** branch 3's address has no street and ZIP code. It is kept exactly as given until the clinic confirms it.
- **Phones, emails and hours (given by the clinic on 2026-10-17):** branch 1 0922 878 7341, danaroxas.dentalclinic@gmail.com;
  branch 2 0922 878 7341 (same as branch 1, to be confirmed), danaroxasdental@gmail.com; branch 3 0933 867 8725, no email.
  All branches: Monday to Friday 8:00 AM to 8:00 PM, Saturday 8:00 AM to 5:00 PM, Sunday closed (`RealBranchSeeder::HOURS`,
  stored per day in `branches.weekly_hours`).
