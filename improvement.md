# Improvement Plan — kg-system

สรุปจากการรีวิวโค้ด (14 ส.ค. 2026) เรียงตามความสำคัญ: Security → Bugs → Quality

---

## 1. Security (วิกฤต — ต้องแก้ก่อน)

### 1.1 Cypher Injection ใน `/query/graph`
- `get_neighborhood()` ที่ `api/graph_rag.py:195` นำ `node_type` และ `depth` จาก user input ไปต่อ string ใน Cypher ตรง ๆ (`f"MATCH path = (n:{node_type})-[*1..{depth}]-(neighbor)"`)
- ผู้เรียกสามารถส่ง `node_type` เช่น ``}) DETACH DELETE ALL //`` เพื่อแก้ไข/ลบกราฟทั้งหมดได้
- **แนวทางแก้:** validate `node_type` กับ allowlist ของ labels ที่รู้จัก, จำกัด `depth` (1–5) และ cast เป็น int

### 1.2 `/run/cypher` รัน Cypher อะไรก็ได้
- `api/main.py:182` รับ raw Cypher ไป execute โดยไม่กรอง — ทำ `DETACH DELETE ALL` หรือเขียนข้อมูลได้
- **แนวทางแก้:** อนุญาตเฉพาะ read-only (ตรวจว่าไม่มี CREATE/MERGE/SET/DELETE/REMOVE) หรือลบ endpoint นี้ออกแล้วไปใช้ `/query/cypher` แทน

### 1.3 Auth ถูกปิดโดยค่า default
- `api/main.py:41`: ถ้า `api_key == "changeme"` จะ **ข้ามการ auth ทั้งหมด** และค่า default คือ `changeme` → production ที่ไม่ได้ตั้ง key = เปิดโล่ง
- รวมกับ CORS `allow_origins=["*"]` และ `GraphCypherQAChain(allow_dangerous_requests=True)` (`api/graph_rag.py:96`) = ใครก็ลบกราฟได้ผ่าน browser
- **แนวทางแก้:** fail-closed (reject ถ้า key ยังเป็น default หรือไม่ได้ตั้ง), จำกัด CORS origin, พิจารณาปิด `/run/cypher`

### 1.4 Ingestion API ไม่มี auth เลย
- `ingestion/main.py` ทุก endpoint เปิดหมด — ใครก็อัปโหลด PDF เพื่อเผา LLM token ได้
- **Path traversal:** `dest = INPUT_DIR / file.filename` (`ingestion/main.py:103`) — filename ที่มี `../` อาจเขียนไฟล์นอก directory ได้ ต้องใช้ `Path(file.filename).name` + ตรวจสอบ
- ไม่มี file size limit (`await file.read()` อ่านทั้งหมดเข้า memory)
- **แนวทางแก้:** เพิ่ม API key middleware, sanitize filename, stream to disk, จำกัดขนาดไฟล์

### 1.5 API key ฝังใน web bundle
- `web/Dockerfile` ส่ง `VITE_API_KEY` เข้า build → key ฝังอยู่ใน JS ที่ browser ดาวน์โหลด ใครก็ดึงได้
- **แนวทางแก้:** ให้ web server (`server.js`) เป็น proxy ที่แนบ key ฝั่ง server แทน

### 1.6 `/config` เปิดเผย API key บางส่วน
- `ingestion/main.py:148` แสดง 8 ตัวแรก + 4 ตัวสุดท้ายของ key — มากเกินไป ควรปิดทั้งหมดหรือแสดงแค่ 4 ตัวท้าย

### 1.7 ความสะอาดของ repo
- ไม่มี `.gitignore` ที่ root — `.env` ถูก commit เข้า repo (แม้ตอนนี้ว่าง), `.claude/settings.local.json` ก็ถูก commit
- PDF 36MB ถูก commit ใน `data/` (รวมถึง ISO 9001 ซึ่งเป็นเอกสารมีลิขสิทธิ์) — ควรเอาออกและใช้ Git LFS หรือ volume แยก
- Default credentials `neo4j/changeme` ฝังใน `docker-compose.yml` + healthcheck
- **แนวทางแก้:** เพิ่ม `.gitignore`, ลบไฟล์เหล่านี้จาก history (`git filter-repo`), ดึง secrets ออก compose

---

## 2. Bugs

### 2.1 Qdrant vector size ไม่ตรงกับ embedding model
- `ingestion/config.py` default `qdrant_vector_size = 1024` แต่ default `EMBEDDING_MODEL = text-embedding-3-small` (1536 dims) และ `docker-compose.yml` ไม่ได้ส่ง `QDRANT_VECTOR_SIZE`
- → collection ถูกสร้างขนาด 1024 แต่ vectors เข้ามา 1536 → ingestion พังตั้งแต่ไฟล์แรก
- **แนวทางแก้:** คำนวณ size จาก model อัตโนมัติ หรือส่ง env ผ่าน compose และ validate ตอน startup

### 2.2 `neo4j-init.cypher` ไม่เคยถูกรัน
- `docker-compose.yml` mount ไปที่ `/docker-entrypoint-initdb.d/` ซึ่งเป็น convention ของ MySQL/Postgres — image ของ Neo4j ไม่มีระบบนี้ → constraints/indexes/seed data ไม่เคยถูกสร้าง
- **แนวทางแก้:** รัน init ผ่าน entrypoint script หรือ `cypher-shell` หลัง service healthy

### 2.3 Indexes ใน `_ensure_indexes` ขัดกับ schema จริง
- `pipeline.py:207` สร้าง index บน `Component.name`/`Standard.name` แต่ code ทั้งหมดใช้ `n.id` เป็น identifier (ตาม prompt ใน `graph_rag.py`)

### 2.4 Re-ingest ซ้ำ = ข้อมูลซ้ำ
- ไม่มี dedup — อัปโหลดไฟล์เดิมซ้ำจะสร้าง nodes/vectors ซ้ำทั้งหมด; `/ingest/watch` จะ ingest ทุกไฟล์ใน input ทุกครั้งที่เรียก
- **แนวทางแก้:** hash เนื้อหาไฟล์ก่อน ingest, MERGE Document node จาก hash

---

## 3. Quality / Engineering

### 3.1 ไม่มี tests และ CI
- ไม่มี test เลยทั้ง Python และ TypeScript — อย่างน้อยเพิ่ม pytest สำหรับจุดเสี่ยง (injection, auth) และ GitHub Actions (lint + test + build)

### 3.2 Job tracking เป็น in-memory dict
- `ingestion/main.py:65` — หายเมื่อ restart และโตได้ไม่จำกัด (memory leak) — ควรใช้ persistent store หรืออย่างน้อยก็จำกัดขนาด

### 3.3 Structured logging
- ใช้ `print()` ทั้งหมด — เปลี่ยนเป็น `logging`/`structlog` พร้อม request id เพื่อ debug

### 3.4 Streaming เป็นของปลอม
- `api/main.py:79` รัน query จนเสร็จก่อนแล้วค่อย "stream" ทีละคำ — ถ้าจะ stream ควร stream จาก LLM จริง ๆ ไม่งั้นเอาออก

### 3.5 Pin dependencies
- หลาย package ใช้ range (`>=,<`) — เพิ่ม lockfile (pip-tools/poetry) เพื่อให้ build reproducible

### 3.6 Documentation
- Commit messages ("ok", "complete") ไม่สื่อความหมาย; เพิ่ม CONTRIBUTING.md และอธิบาย architecture ใน README ให้ครบ (web frontend ไม่ได้โผล่ใน Project Structure ของ README)

---

## แผนดำเนินการ (แนะนำ)

| ลำดับ | งาน | Branch |
|---|---|---|
| 1 | แก้ Cypher injection + read-only `/run/cypher` | `fix/cypher-injection` |
| 2 | Fail-closed auth + CORS | `fix/auth-hardening` |
| 3 | Auth + sanitize + size limit ฝั่ง ingestion | `fix/ingestion-security` |
| 4 | แก้ vector size mismatch + neo4j init | `fix/bootstrap-bugs` |
| 5 | Proxy API key ใน web server | `fix/web-key-proxy` |
| 6 | Repo hygiene (.gitignore, ลบ PDF/.env, filter history) | `chore/repo-hygiene` |
| 7 | Tests + CI | `feat/tests-ci` |
