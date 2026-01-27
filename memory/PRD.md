# Just Vitality Clinic - PRD & Project Status

## Original Problem Statement
System do obsługi kliniki Just Vitality. Obecna implementacja: Google Sheets + Apps Script.
Problemy zgłoszone przez użytkownika:
1. **BUG**: Po rejestracji w kiosku pacjent nie pojawia się w kolejce
2. Brak spójności danych
3. Potrzeba lepszych raportów (dzienne, tygodniowe, obłożenie, eksport)
4. Ogólny brak "szlifu" w UI

## User Personas
1. **Pracownik kliniki (Staff/Manager)** - zarządzanie pacjentami, wizyty, raporty
2. **Administrator (Admin)** - zarządzanie użytkownikami, pełny dostęp
3. **Pacjent** - samodzielna rejestracja w kiosku

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Auth**: JWT tokens

## What's Been Implemented (2026-01-27)

### Session 1 - MVP
- [x] Backend API complete (auth, patients, queue, visits, reports)
- [x] Launcher, Login, Kiosk, Staff Portal, Analytics pages
- [x] Queue bug fixed

### Session 2 - Bug Fixes (5 issues resolved)
- [x] **Fix #1**: Home button no longer logs out user - stays logged in
- [x] **Fix #2**: Admin Panel modal with full functionality
- [x] **Fix #3**: PDF export for patient cards and reports
- [x] **Fix #4**: Signature pads in Kiosk for consent forms
- [x] **Fix #5**: Admin operations (Users, Login Log, System Audit)

### Features:
- **Staff Portal**: Patient list, queue, edit profile, new visit, change log, PDF export
- **Admin Panel**: Add users, reset passwords, lock/unlock accounts, login audit, system audit, clear logs
- **Kiosk**: 3-step registration with finger signature capture
- **Analytics**: KPIs, charts, heatmap, PDF export

## Testing Status
- Backend: 95.2% tests passed
- Frontend: 100% tests passed
- Integration: 100% tests passed
- Fixes verification: 100%

## Credentials
- Default Admin: `ADMIN` / `vit2025`

## Google Sheets Fix (gs_fixed.txt)
Poprawiony plik `/app/gs_fixed.txt` zawiera:
- Daily_Queue z 7 kolumnami (dodano Reason)
- processRegistration wpisuje "WAITING" do Status
- getDashboardData poprawnie czyta strukturę

## Prioritized Backlog

### P0 (Done)
- [x] All 5 bug fixes
- [x] Kiosk with signatures
- [x] Admin Panel complete
- [x] PDF exports
- [x] **Data Management (2026-01-27):**
  - [x] Usuwanie wszystkich pacjentów (z hasłem)
  - [x] Usuwanie wszystkich wizyt (z hasłem)
  - [x] Czyszczenie kolejki (z hasłem)
  - [x] Tworzenie kopii zapasowych
  - [x] Przywracanie z kopii zapasowych
  - [x] Usuwanie kopii zapasowych

### P1 (Next)
- [ ] Import danych z Google Sheets
- [ ] Email notifications
- [ ] Mobile app version

### P2 (Future)
- [ ] Appointment scheduling
- [ ] Multi-clinic support
