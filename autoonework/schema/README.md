# D1 스키마

이 폴더는 운영 D1의 기준 스키마 파일을 보관한다.

```bash
scripts/export-d1-schema.sh
```

위 명령은 원격 D1에서 데이터 없이 테이블 구조만 `schema/groupware-schema.sql`로 저장한다.

스키마를 원격 D1에 적용해야 할 때는 반드시 적용 대상 DB와 파일을 확인한 뒤 실행한다.

```bash
CONFIRM_APPLY=YES scripts/apply-d1-schema.sh
```
