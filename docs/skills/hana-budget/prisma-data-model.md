# HANA Budget Skill - Prisma Data Model

## 문서 목적
이 문서는 `prisma/schema.prisma`를 수정할 때 지켜야 할 도메인 모델 기준을 정리한다.

이 프로젝트의 Prisma 스키마는 단순 CRUD가 아니라  
**예산 운영 플랫폼의 도메인 모델**이다.

---

## 핵심 모델 간 관계

### Organization
예산의 실제 주체다.

예:
- 학교
- 학생처
- 총학생회
- 통계학과 학생회
- 특정 동아리

### User
로그인/접속 주체다.

중요:
- User와 Organization은 다르다
- 예산 소유 주체는 User가 아니라 Organization이다

### BudgetRequest
동아리/학생회가 먼저 제출하는 예산 신청서다.

### Budget
승인 후 발행된 예산이다.

중요 필드:
- totalAmount
- currentBalance
- validFrom
- validUntil
- status
- organizationId
- issuerOrganizationId
- sourceRequestId

### Policy
Budget에 1:1로 붙는 규칙이다.

### Transaction
집행 요청 기록이다.

### LedgerEntry
실제 잔액 변화 원장이다.

### BudgetSettlement
정산/종료 보고다.

### Merchant
가맹점 관리 단위다.

### AnchorRecord
감사 이벤트 앵커링 기록이다.

---

## 절대 원칙
- Organization을 예산의 주체로 본다.
- BudgetRequest -> Budget 흐름을 유지한다.
- Budget -> Policy는 1:1 의미를 유지한다.
- Budget -> LedgerEntry는 잔액 변화 기준이다.
- currentBalance만 믿고 원장 의미를 약화시키지 않는다.
- AnchorRecord를 단순 로그 수준으로 축소하지 않는다.

---

## seed 데이터 원칙
스키마를 수정하면 seed도 같이 맞춘다.

반드시 포함:
- 발행기관 Organization
- 동아리 Organization
- 관리자 User
- 동아리 User
- 예산 신청서
- 승인된 Budget
- Policy
- Transaction 예시
- LedgerEntry 예시
- Merchant 예시
- AnchorRecord 예시
