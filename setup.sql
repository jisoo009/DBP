-- ============================================================
--  MealTalk 급식톡 — MySQL Workbench 초기 설정 SQL
--  순서대로 실행하세요 (File > Run SQL Script)
-- ============================================================

-- 1. 데이터베이스 생성
CREATE DATABASE IF NOT EXISTS mealtalk_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE mealtalk_db;

-- 2. 기존 테이블 생성 (이미 있으면 무시)
CREATE TABLE IF NOT EXISTS meal (
    meal_id   INT PRIMARY KEY AUTO_INCREMENT,
    meal_date DATE        NOT NULL,
    meal_type VARCHAR(10) NOT NULL   COMMENT '아침/점심/저녁'
);

CREATE TABLE IF NOT EXISTS menu (
    menu_id   INT PRIMARY KEY AUTO_INCREMENT,
    meal_id   INT          NOT NULL,
    menu_name VARCHAR(100) NOT NULL,
    category  VARCHAR(20),
    FOREIGN KEY (meal_id) REFERENCES meal(meal_id)
);

CREATE TABLE IF NOT EXISTS nutrition (
    nutrition_id INT PRIMARY KEY AUTO_INCREMENT,
    menu_id      INT NOT NULL,
    calories     INT,
    protein      FLOAT,
    FOREIGN KEY (menu_id) REFERENCES menu(menu_id)
);

CREATE TABLE IF NOT EXISTS student (
    student_id   INT PRIMARY KEY AUTO_INCREMENT,
    student_name VARCHAR(30) NOT NULL,
    grade        INT,
    class_num    INT
);

CREATE TABLE IF NOT EXISTS review (
    review_id  INT PRIMARY KEY AUTO_INCREMENT,
    menu_id    INT NOT NULL,
    student_id INT NOT NULL,
    rating     INT,
    comment    VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (menu_id)    REFERENCES menu(menu_id),
    FOREIGN KEY (student_id) REFERENCES student(student_id)
);

-- ============================================================
--  3. student 테이블에 로그인용 컬럼 추가 (★ 핵심)
--     이미 컬럼이 있으면 "Duplicate column" 오류가 나도 괜찮습니다.
--     그 경우 해당 줄만 주석 처리하세요.
-- ============================================================
ALTER TABLE student ADD COLUMN username   VARCHAR(30)  UNIQUE        COMMENT '로그인 아이디';
ALTER TABLE student ADD COLUMN password   VARCHAR(100)               COMMENT 'bcrypt 해시';
ALTER TABLE student ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '가입일시';
ALTER TABLE student ADD COLUMN last_login DATETIME                   COMMENT '마지막 로그인';

-- 4. 인덱스 (조회 속도 향상)
-- MySQL은 CREATE INDEX에 IF NOT EXISTS를 지원하지 않으므로
-- UNIQUE 컬럼 선언 시 이미 인덱스가 자동 생성됩니다 → 별도 생성 불필요
-- (중복 실행 시 오류 방지를 위해 아래 방식으로 대체)
SELECT IF(
  COUNT(*) = 0,
  'ALTER TABLE student ADD INDEX idx_student_username (username)',
  'SELECT ''인덱스 이미 존재'''
) INTO @sql
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND table_name   = 'student'
  AND index_name   = 'idx_student_username';
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ============================================================
--  5. 샘플 데이터
-- ============================================================

-- 급식 샘플
INSERT IGNORE INTO meal (meal_id, meal_date, meal_type) VALUES
  (1, CURDATE(), '점심'),
  (2, DATE_ADD(CURDATE(), INTERVAL 1 DAY), '점심');

INSERT IGNORE INTO menu (menu_id, meal_id, menu_name, category) VALUES
  (1, 1, '현미밥',       '주식'),
  (2, 1, '된장찌개',     '국'),
  (3, 1, '제육볶음',     '주찬'),
  (4, 1, '깍두기',       '김치'),
  (5, 1, '우유',         '음료'),
  (6, 2, '잡곡밥',       '주식'),
  (7, 2, '미역국',       '국'),
  (8, 2, '닭갈비',       '주찬'),
  (9, 2, '배추김치',     '김치');

INSERT IGNORE INTO nutrition (menu_id, calories, protein) VALUES
  (1, 150, 3.2),
  (2,  45, 2.8),
  (3, 220, 18.5),
  (4,  15, 0.8),
  (5, 130, 6.3);

-- 테스트 학생 계정 (비밀번호: test1234 → bcrypt 해시)
INSERT IGNORE INTO student (student_id, student_name, grade, class_num, username, password)
VALUES (1, '홍길동', 3, 2, 'test_user',
        '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy');

-- ============================================================
--  6. 최종 확인
-- ============================================================
SELECT '=== student 컬럼 목록 ===' AS info;
SHOW COLUMNS FROM student;

SELECT '=== 등록된 학생 ===' AS info;
SELECT student_id, student_name, grade, class_num, username, created_at FROM student;

SELECT '=== 오늘 급식 메뉴 ===' AS info;
SELECT m.meal_date, m.meal_type, mn.menu_name, mn.category, n.calories
FROM meal m
JOIN menu mn ON mn.meal_id = m.meal_id
LEFT JOIN nutrition n ON n.menu_id = mn.menu_id
WHERE m.meal_date = CURDATE();
