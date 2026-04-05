# HANA Budget Skill - Audit Anchor

## 문서 목적
이 문서는 `AnchorRecord`와 블록체인/감사 확장 기능을 다룰 때 AI가 따라야 할 기준을 정리한다.

이 프로젝트에서 블록체인은 결제 처리 레이어가 아니다.  
**핵심 운영 이벤트를 위변조 방지용으로 남기는 감사 레이어**다.

---

## 블록체인의 역할 정의
이 프로젝트에서 블록체인은 아래 역할을 가진다.

- 핵심 이벤트 해시 기록
- 정책 변경 이력 보호
- 승인/반려 의사결정 추적
- 정산 보고 신뢰성 보강

즉, “예산 운영의 감사 가능성”을 강화하는 역할이다.

---

## AnchorRecord의 의미
`AnchorRecord`는 단순 로그 테이블이 아니다.  
“이 이벤트는 특정 시점에 특정 payload로 존재했다”는 것을 증명하기 위한 기록이다.

주요 필드:
- eventType
- entityType
- entityId
- payloadHash
- chainStatus
- txHash
- anchoredAt

---

## 어떤 이벤트를 앵커링해야 하는가
### 반드시 고려할 대상
- Budget 발행
- Policy 스냅샷 생성
- Transaction 승인/반려 결정
- Settlement 제출
- 환수 처리

### 굳이 올리지 않아도 되는 것
- 로그인 세션
- 일반 페이지 조회
- 임시 폼 입력
- 모든 AI 분석 원문
- 단순 경고/알림

---

## 권장 구조
### hashPayload 역할
- 이벤트용 payload 정규화
- JSON stable stringify
- hash 생성

### anchorService 역할
- AnchorRecord 생성
- mock/local anchoring 수행
- fake txHash 또는 실제 txHash 저장
- 실패 시 상태 변경

---

## 감사 화면에서 보여줘야 할 것
- eventType
- entityType
- entityId
- payloadHash 앞부분
- chainStatus
- txHash
- anchoredAt

중요:
감사 화면은 블록체인 기술 데모가 아니라  
**“이 의사결정은 추적 가능하다”**는 신뢰 경험을 줘야 한다.
