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

## Core Requirements
- Kiosk: self-check-in dla pacjentów (3 kroki)
- Staff Portal: zarządzanie pacjentami i wizytami
- Analytics: raporty, KPI, heatmapa
- Admin Panel: zarządzanie użytkownikami
- Spójność danych między wszystkimi modułami

## Architecture
- **Frontend**: React 19 + Tailwind CSS + Shadcn UI
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **Auth**: JWT tokens

## What's Been Implemented (2026-01-27)

### Backend API (/app/backend/server.py)
- [x] Authentication: login, logout, change password, JWT tokens
- [x] Admin: user management, login audit
- [x] Patients: CRUD operations, audit logs
- [x] Kiosk: patient check, registration (with queue addition - BUG FIXED)
- [x] Queue: daily queue management
- [x] Visits: create, list by patient
- [x] Reports: summary, daily stats, consultant stats, heatmap data

### Frontend Pages
- [x] **Launcher** (`/`) - wybór modułu
- [x] **Login** (`/login`) - autoryzacja
- [x] **Kiosk** (`/kiosk`) - 3-step registration flow
- [x] **Staff Portal** (`/staff`) - patient management, visits
- [x] **Analytics** (`/analytics`) - charts, KPIs, heatmap

### Bug Fix
- [x] **CRITICAL**: Pacjent teraz poprawnie dodawany do kolejki po rejestracji w kiosku

### Testing Status
- Backend: 95.2% tests passed
- Frontend: 100% tests passed
- Integration: 100% tests passed

## Prioritized Backlog

### P0 (Done)
- [x] Kiosk registration with queue integration
- [x] Staff Portal with patient management
- [x] Analytics with KPIs and charts

### P1 (Next)
- [ ] PDF export for patient records
- [ ] PDF export for reports
- [ ] Admin Panel UI (currently users managed via API)
- [ ] Mobile responsiveness improvements

### P2 (Future)
- [ ] Email notifications
- [ ] Appointment scheduling
- [ ] Treatment templates
- [ ] Multi-clinic support

## Credentials
- Default Admin: `ADMIN` / `vit2025`

## Tech Debt
- Minor API inconsistency: `/api/kiosk/check` uses query params instead of JSON body

## Next Steps
1. Build Admin Panel UI in Staff Portal
2. Add PDF export functionality
3. Consider migration from Google Sheets (import existing data)
