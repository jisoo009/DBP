// MealTalk 급식톡 - Backend Server
// Node.js + Express + MySQL
// 실행 방법: npm install && node server.js

const express = require('express');
const mysql   = require('mysql2/promise');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const cors    = require('cors');

const app = express();
app.use(express.json());
app.use(cors({ origin: '*' }));  // 개발용 전체 허용 — 배포 시 origin을 프론트 주소로 변경

// ─── MySQL 연결 설정 ─────────────────────────────────────────────────────────
// ★ 본인 MySQL Workbench 정보로 수정하세요
const dbConfig = {
  host:             'localhost',
  port:             3306,
  user:             'root',
  password:         '1234',  // ← 여기만 바꾸세요
  database:         'mealtalk_db',
  waitForConnections: true,
  connectionLimit:  10,
  charset:          'utf8mb4',
};

let pool;

async function initDB() {
  pool = mysql.createPool(dbConfig);

  const conn = await pool.getConnection();
  try {
    // student 테이블에 로그인 컬럼이 없으면 자동으로 추가
    // (이미 있으면 무시 — IF NOT EXISTS 없으므로 try/catch로 처리)
    const alterQueries = [
      `ALTER TABLE student ADD COLUMN username VARCHAR(30) UNIQUE`,
      `ALTER TABLE student ADD COLUMN password VARCHAR(100)`,
      `ALTER TABLE student ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP`,
      `ALTER TABLE student ADD COLUMN last_login DATETIME`,
    ];

    for (const q of alterQueries) {
      try {
        await conn.query(q);
        console.log('✅ 컬럼 추가:', q.split('ADD COLUMN')[1]?.trim().split(' ')[0]);
      } catch (e) {
        if (e.code === 'ER_DUP_FIELDNAME') {
          // 이미 존재하는 컬럼 → 정상, 무시
        } else {
          throw e;
        }
      }
    }

    console.log('✅ MySQL 연결 성공 | student 테이블 준비 완료');
  } finally {
    conn.release();
  }
}

const JWT_SECRET = 'mealtalk_jwt_secret_change_in_production';

// ─── 미들웨어: JWT 인증 ──────────────────────────────────────────────────────
function authMiddleware(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ message: '로그인이 필요합니다.' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: '토큰이 만료되었습니다. 다시 로그인해주세요.' });
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  AUTH API
// ════════════════════════════════════════════════════════════════════════════

// [POST] /api/register  회원가입
// body: { name, username, password, grade, classNum }
app.post('/api/register', async (req, res) => {
  const { name, username, password, grade, classNum } = req.body;

  // ── 입력값 검증 ──
  if (!name || !username || !password || !grade || !classNum) {
    return res.status(400).json({ message: '모든 필드를 입력해주세요.' });
  }
  if (username.length < 4 || username.length > 20) {
    return res.status(400).json({ message: '아이디는 4~20자여야 합니다.' });
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return res.status(400).json({ message: '아이디는 영문, 숫자, 밑줄(_)만 사용 가능합니다.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ message: '비밀번호는 최소 6자 이상이어야 합니다.' });
  }

  try {
    // 아이디 중복 확인
    const [existing] = await pool.query(
      'SELECT student_id FROM student WHERE username = ?', [username]
    );
    if (existing.length > 0) {
      return res.status(409).json({ message: '이미 사용 중인 아이디입니다.' });
    }

    // bcrypt 해싱 후 student 테이블에 INSERT
    const hashed = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      `INSERT INTO student (student_name, grade, class_num, username, password)
       VALUES (?, ?, ?, ?, ?)`,
      [name, grade, classNum, username, hashed]
    );

    res.status(201).json({
      message: '회원가입이 완료되었습니다!',
      studentId: result.insertId,
    });
  } catch (err) {
    console.error('회원가입 오류:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// [POST] /api/login  로그인
// body: { username, password }
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: '아이디와 비밀번호를 입력해주세요.' });
  }

  try {
    const [rows] = await pool.query(
      'SELECT * FROM student WHERE username = ?', [username]
    );
    if (rows.length === 0) {
      return res.status(401).json({ message: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }

    const student = rows[0];

    if (!student.password) {
      return res.status(401).json({ message: '비밀번호가 설정되지 않은 계정입니다.' });
    }

    const match = await bcrypt.compare(password, student.password);
    if (!match) {
      return res.status(401).json({ message: '아이디 또는 비밀번호가 올바르지 않습니다.' });
    }

    // 마지막 로그인 시각 업데이트
    await pool.query(
      'UPDATE student SET last_login = NOW() WHERE student_id = ?',
      [student.student_id]
    );

    // JWT 발급 (24시간)
    const token = jwt.sign(
      {
        id:       student.student_id,
        username: student.username,
        name:     student.student_name,
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: '로그인 성공!',
      token,
      user: {
        id:       student.student_id,
        name:     student.student_name,
        username: student.username,
        grade:    student.grade,
        classNum: student.class_num,
      },
    });
  } catch (err) {
    console.error('로그인 오류:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// [GET] /api/check-username?username=xxx  아이디 중복 확인
app.get('/api/check-username', async (req, res) => {
  const { username } = req.query;
  if (!username) {
    return res.status(400).json({ message: 'username 파라미터가 필요합니다.' });
  }
  try {
    const [rows] = await pool.query(
      'SELECT student_id FROM student WHERE username = ?', [username]
    );
    res.json({ available: rows.length === 0 });
  } catch (err) {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// [GET] /api/me  내 정보 조회 (JWT 필요)
app.get('/api/me', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT student_id, student_name, username, grade, class_num, created_at, last_login
       FROM student WHERE student_id = ?`,
      [req.user.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: '학생 정보를 찾을 수 없습니다.' });
    }
    const s = rows[0];
    res.json({
      id:        s.student_id,
      name:      s.student_name,
      username:  s.username,
      grade:     s.grade,
      classNum:  s.class_num,
      createdAt: s.created_at,
      lastLogin: s.last_login,
    });
  } catch (err) {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// ════════════════════════════════════════════════════════════════════════════
//  급식 관련 API (추가 활용 가능)
// ════════════════════════════════════════════════════════════════════════════

// [GET] /api/meals?date=YYYY-MM-DD  날짜별 급식 조회
app.get('/api/meals', async (req, res) => {
  const { date } = req.query;
  try {
    const where = date ? 'WHERE m.meal_date = ?' : '';
    const params = date ? [date] : [];

    const [rows] = await pool.query(
      `SELECT
         m.meal_id, m.meal_date, m.meal_type,
         mn.menu_id, mn.menu_name, mn.category,
         n.calories, n.protein
       FROM meal m
       LEFT JOIN menu mn ON mn.meal_id = m.meal_id
       LEFT JOIN nutrition n ON n.menu_id = mn.menu_id
       ${where}
       ORDER BY m.meal_date DESC, m.meal_type, mn.menu_id`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error('급식 조회 오류:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// [POST] /api/reviews  리뷰 작성 (JWT 필요)
// body: { menuId, rating, comment }
app.post('/api/reviews', authMiddleware, async (req, res) => {
  const { menuId, rating, comment } = req.body;
  if (!menuId || !rating) {
    return res.status(400).json({ message: 'menuId와 rating은 필수입니다.' });
  }
  if (rating < 1 || rating > 5) {
    return res.status(400).json({ message: '별점은 1~5점 사이여야 합니다.' });
  }
  try {
    // 중복 리뷰 방지
    const [dup] = await pool.query(
      'SELECT review_id FROM review WHERE menu_id = ? AND student_id = ?',
      [menuId, req.user.id]
    );
    if (dup.length > 0) {
      return res.status(409).json({ message: '이미 리뷰를 작성하셨습니다.' });
    }

    const [result] = await pool.query(
      'INSERT INTO review (menu_id, student_id, rating, comment) VALUES (?, ?, ?, ?)',
      [menuId, req.user.id, rating, comment || null]
    );
    res.status(201).json({ message: '리뷰가 등록되었습니다.', reviewId: result.insertId });
  } catch (err) {
    console.error('리뷰 작성 오류:', err);
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// [GET] /api/reviews/:menuId  특정 메뉴 리뷰 목록
app.get('/api/reviews/:menuId', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
         r.review_id, r.rating, r.comment, r.created_at,
         s.student_name, s.grade, s.class_num
       FROM review r
       JOIN student s ON s.student_id = r.student_id
       WHERE r.menu_id = ?
       ORDER BY r.created_at DESC`,
      [req.params.menuId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: '서버 오류가 발생했습니다.' });
  }
});

// ─── 서버 시작 ───────────────────────────────────────────────────────────────
const PORT = 4000;
initDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`\n🚀 MealTalk 서버 실행 중 → http://localhost:${PORT}`);
      console.log(`\n   [ AUTH ]`);
      console.log(`   POST /api/register               회원가입`);
      console.log(`   POST /api/login                  로그인 (JWT 발급)`);
      console.log(`   GET  /api/check-username?username=xxx  아이디 중복 확인`);
      console.log(`   GET  /api/me                     내 정보 (JWT 필요)`);
      console.log(`\n   [ 급식 ]`);
      console.log(`   GET  /api/meals?date=YYYY-MM-DD  날짜별 급식 조회`);
      console.log(`   POST /api/reviews                리뷰 작성 (JWT 필요)`);
      console.log(`   GET  /api/reviews/:menuId        메뉴별 리뷰 목록\n`);
    });
  })
  .catch((err) => {
    console.error('\n❌ DB 연결 실패:', err.message);
    console.error('   → MySQL Workbench에서 서버가 실행 중인지 확인하세요.');
    console.error('   → server.js 상단 dbConfig의 password를 본인 비밀번호로 변경하세요.\n');
  });
