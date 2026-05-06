## 🚀 KSP Financial Management System

A centralized financial system designed to transform manual cooperative operations into a structured, real-time digital platform.

### Problem
Manual data recording caused duplicate entries, reporting delays (2–3 days), and high risk of human error, limiting operational visibility.

### Solution
Designed and built a modular backend system using NestJS, PostgreSQL, and Redis to centralize financial workflows and ensure data consistency.

### Impact
- Real-time financial reporting (previously 2–3 days)
- Eliminated duplicate data entry (single source of truth)
- Automated financial calculations
- Improved accountability with RBAC and audit logs

### System Architecture
<img width="1603" height="601" alt="Arsitektur" src="https://github.com/user-attachments/assets/49339f6c-96dc-4589-b201-51f6bdb7da52" />


### Database Design
<img width="1368" height="1909" alt="ERD Design" src="https://github.com/user-attachments/assets/c36fd271-80dd-4045-a9c1-24a91c1fef48" />


# KSP Backend API
Backend API untuk sistem **Koperasi Simpan Pinjam (KSP)**.

API ini menangani proses bisnis utama koperasi: manajemen nasabah, simpanan, pinjaman, transaksi, laporan, dashboard, pengaturan sistem, serta autentikasi dan RBAC.

![NestJS](https://img.shields.io/badge/NestJS-11-E0234E?logo=nestjs)
![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=node.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql)
![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)
![License](https://img.shields.io/badge/license-UNLICENSED-lightgrey)

## Project Overview

Backend ini dirancang untuk operasional koperasi berbasis REST API dengan fokus pada:

- Manajemen User, Role, Permission (RBAC)
- Manajemen Pegawai
- Manajemen Nasabah
- Simpanan (setoran/penarikan)
- Pinjaman (pengajuan, verifikasi, pencairan, angsuran)
- Transaksi keuangan
- Laporan keuangan & dashboard
- Audit trail aktivitas
- Pengaturan sistem dinamis

## System Architecture

```mermaid
flowchart LR
  A[Frontend Admin] --> B[REST API - NestJS]
  B --> C[(PostgreSQL)]
  B --> D[(Redis Cache)]
  B --> E[(MinIO Object Storage)]
  B --> F[Swagger API Docs]
  G[GitHub Actions CI] --> B
```

Arsitektur utama:

- **API Layer**: NestJS (modular architecture)
- **Data Access**: Prisma ORM
- **Database**: PostgreSQL
- **Cache**: Redis
- **Object Storage**: MinIO
- **Auth**: JWT + RBAC (roles & permissions)
- **Observability**: Winston logger + exception filter
- **Containerization**: Docker + Docker Compose
- **CI**: GitHub Actions (integration test pipeline)

## Tech Stack

- Node.js 20+
- NestJS 11
- TypeScript
- Prisma ORM
- PostgreSQL
- Redis
- MinIO
- Docker / Docker Compose
- Swagger (OpenAPI)
- Jest (integration testing)

## Features

- Authentication (access & refresh token)
- Authorization berbasis role & permission
- CRUD domain koperasi (pegawai, nasabah, simpanan, pinjaman, transaksi)
- Validasi bisnis transaksi (validation-first, atomic transaction)
- Soft delete untuk entitas tertentu
- Laporan bulanan, cashflow, anggota, pinjaman, simpanan, transaksi
- Dashboard ringkasan operasional
- Audit trail untuk aktivitas kritikal

## Project Structure

```text
src/
├── common/              # shared module: guards, decorators, cache, logger, dll
├── config/              # app/jwt/database config
├── modules/
│   ├── auth/
│   ├── pegawai/
│   ├── nasabah/
│   ├── simpanan/
│   ├── pinjaman/
│   ├── transaksi/
│   ├── laporan/
│   ├── dashboard/
│   ├── settings/
│   └── audit/
├── app.module.ts
└── main.ts

prisma/
├── schema.prisma
├── migrations/
└── seed-auth.js

test/
├── integration/
├── helpers/
├── jest-integration.json
└── jest-e2e.json
```

## Installation

```bash
npm install
```

## Running the Project

### Development

```bash
npm run start:dev
```

### Production Build

```bash
npm run build
npm run start:prod
```

## Database (Prisma)

```bash
# generate Prisma client
npx prisma generate

# local migration (development)
npx prisma migrate dev

# apply migration existing (deployment/CI)
npx prisma migrate deploy

# seed data auth awal
node prisma/seed-auth.js
```

## Docker

Jalankan semua service lokal (API, PostgreSQL, Redis, MinIO):

```bash
docker compose up -d --build
```

Stop service:

```bash
docker compose down
```

## API Documentation

Swagger tersedia di:

```text
http://localhost:3000/api-docs
```

## Testing

```bash
# unit test (default jest)
npm run test

# integration test (dipakai di CI)
npm run test:integration

# e2e config tersedia (suite bisa ditambahkan sesuai kebutuhan)
npm run test:e2e
```

## CI/CD

GitHub Actions workflow tersedia di `.github/workflows/ci.yml` dengan proses utama:

1. Install dependency
2. Generate Prisma client
3. Push schema ke database test
4. Jalankan integration test

## Security Notes

- Ganti `JWT_SECRET` pada environment production.
- Jangan commit `.env` production ke repository.
- Batasi akses endpoint sensitif melalui RBAC.

## Author

**Yogi Hafidh Maulana**  
Backend Engineer / Software Engineer

## License

UNLICENSED (private repository)
