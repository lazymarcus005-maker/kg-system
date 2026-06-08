// ── Constraints (uniqueness) ────────────────────────────────────────
CREATE CONSTRAINT std_id IF NOT EXISTS
  FOR (s:Standard) REQUIRE s.id IS UNIQUE;

CREATE CONSTRAINT clause_id IF NOT EXISTS
  FOR (c:Clause) REQUIRE c.id IS UNIQUE;

CREATE CONSTRAINT req_id IF NOT EXISTS
  FOR (r:Requirement) REQUIRE r.id IS UNIQUE;

CREATE CONSTRAINT control_id IF NOT EXISTS
  FOR (c:Control) REQUIRE c.id IS UNIQUE;

CREATE CONSTRAINT component_name IF NOT EXISTS
  FOR (c:Component) REQUIRE c.name IS UNIQUE;

CREATE CONSTRAINT testcase_id IF NOT EXISTS
  FOR (t:TestCase) REQUIRE t.id IS UNIQUE;

// ── Indexes (search performance) ────────────────────────────────────
CREATE INDEX clause_title IF NOT EXISTS
  FOR (c:Clause) ON (c.title);

CREATE INDEX req_text IF NOT EXISTS
  FOR (r:Requirement) ON (r.text);

CREATE FULLTEXT INDEX entity_search IF NOT EXISTS
  FOR (n:Standard|Clause|Requirement|Component|Control)
  ON EACH [n.id, n.name, n.title, n.description];

// ── Seed: ISO standards metadata ────────────────────────────────────
MERGE (s1:Standard {id: 'ISO-29148'})
  SET s1.name = 'ISO/IEC/IEEE 29148:2018',
      s1.title = 'Requirements Engineering',
      s1.description = 'Life cycle processes — Requirements engineering';

MERGE (s2:Standard {id: 'ISO-12207'})
  SET s2.name = 'ISO/IEC/IEEE 12207:2017',
      s2.title = 'Software Life Cycle Processes',
      s2.description = 'Systems and software engineering — Software life cycle processes';

MERGE (s3:Standard {id: 'ISO-42010'})
  SET s3.name = 'ISO/IEC/IEEE 42010:2022',
      s3.title = 'Architecture Description',
      s3.description = 'Systems and software engineering — Architecture description';

MERGE (s4:Standard {id: 'ISO-27001'})
  SET s4.name = 'ISO/IEC 27001:2022',
      s4.title = 'Information Security Management',
      s4.description = 'Information security, cybersecurity and privacy protection';

MERGE (s5:Standard {id: 'ISO-25010'})
  SET s5.name = 'ISO/IEC 25010:2023',
      s5.title = 'Software Quality Model',
      s5.description = 'Systems and software quality models';
