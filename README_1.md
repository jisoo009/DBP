# 🍽️ MealTalk 급식톡 — 로그인 / 회원가입 시스템

## 📁 파일 구조
```
mealtalk/
├── frontend/
│   └── index.html          ← 로그인 / 회원가입 화면
└── backend/
    ├── server.js            ← Node.js API 서버
    ├── package.json         ← 의존성
    └── setup.sql            ← MySQL Workbench 초기 설정
```

---

## ⚙️ 실행 순서

### 1단계 — MySQL Workbench에서 setup.sql 실행
1. MySQL Workbench → 로컬 연결 접속
2. **File → Open SQL Script → setup.sql 선택**
3. ⚡ Execute (번개) 클릭
4. `student` 테이블에 `username`, `password`, `created_at`, `last_login` 컬럼 추가 확인

> ⚠️ `ALTER TABLE` 실행 시 "Duplicate column" 오류가 나면 이미 컬럼이 있는 것 → 무시하고 계속

### 2단계 — server.js 비밀번호 수정
```js
const dbConfig = {
  password: '여기에_본인_MySQL_비밀번호',   // ← 이 줄만 수정
};
```

### 3단계 — 서버 실행
```bash
cd backend
npm install     # 최초 1회
node server.js  # 서버 시작
```
✅ `MealTalk 서버 실행 중 → http://localhost:4000` 출력되면 성공

### 4단계 — 브라우저에서 frontend/index.html 열기

---

## 🗄️ student 테이블 최종 구조

| 컬럼 | 타입 | 설명 |
|------|------|------|
| student_id | INT (PK) | 자동 증가 |
| student_name | VARCHAR(30) | 이름 |
| grade | INT | 학년 |
| class_num | INT | 반 |
| **username** | VARCHAR(30) UNIQUE | 로그인 아이디 ← 추가 |
| **password** | VARCHAR(100) | bcrypt 해시 ← 추가 |
| **created_at** | DATETIME | 가입일시 ← 추가 |
| **last_login** | DATETIME | 마지막 로그인 ← 추가 |

---

## 🔌 API 목록 (포트: 4000)

### 인증
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | `/api/register` | 회원가입 → student 테이블 INSERT |
| POST | `/api/login` | 로그인 → JWT 발급 |
| GET | `/api/check-username?username=xxx` | 아이디 중복 확인 |
| GET | `/api/me` | 내 정보 (Authorization: Bearer {token}) |

### 급식
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/meals?date=2024-06-01` | 날짜별 급식+영양정보 조회 |
| POST | `/api/reviews` | 리뷰 작성 (JWT 필요) |
| GET | `/api/reviews/:menuId` | 메뉴별 리뷰 목록 |

---

## 🧪 테스트 계정
- 아이디: `test_user`  
- 비밀번호: `test1234`
