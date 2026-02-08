# share/ 운영 규칙 (SSOT)

- share/는 팀의 **단일 진실 소스(SSOT)** 입니다.
- 최종 산출물은 share/outbox/에만 둡니다.
- 로그는 share/logs/에만 둡니다.

## 작업ID 규격
- YYYYMMDD-HHMM_<topic>_<owner>

## 파일 네이밍
- outbox: <작업ID>__<type>__vN.md
- logs:   <작업ID>__<cmd>__ok|fail.log

## 동시쓰기 방지
- outbox는 append-only(새 파일 생성) 원칙
- 동일 작업ID에 대한 vN은 지우(Integrator)가 관리
