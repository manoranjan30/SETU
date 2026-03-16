-- ============================================================
-- SETU  |  Block 3 Seed Script
-- Project : Equinox 2  (eps_node id = 2)
-- Block 3  (eps_node id = 407)  -- already exists, empty
-- Source   : Block 4  (eps_node id = 3)  -- has Tower H + Floors GF-12
--
-- Creates:
--   Part 1  EPS child structure for Block 3
--           Tower H3  → Floors GF, 1-12
--   Part 2  WBS + Activities duplicated from Block 4 schedule
--           Dates shifted +6 months  |  codes prefixed B3-
--   Part 3  BOQ items, sub-items, measurements
--           Total budget  ₹35,00,00,000  (350 000 000)
--
-- Idempotent: safe to re-run (skips rows that already exist)
-- ============================================================

BEGIN;

-- ============================================================
-- PART 1 : EPS STRUCTURE
-- ============================================================
DO $$
DECLARE
  v_tower   INT;
  v_gf      INT;
  v_f1      INT;  v_f2  INT;  v_f3  INT;  v_f4  INT;
  v_f5      INT;  v_f6  INT;  v_f7  INT;  v_f8  INT;
  v_f9      INT;  v_f10 INT;  v_f11 INT;  v_f12 INT;
BEGIN

  -- Tower H3 under Block 3
  SELECT id INTO v_tower FROM eps_node WHERE "parentId" = 407 AND name = 'H3' AND type = 'TOWER';
  IF v_tower IS NULL THEN
    INSERT INTO eps_node (name, type, "parentId", "order", "createdBy", "updatedBy")
    VALUES ('H3', 'TOWER', 407, 0, 'system', 'system')
    RETURNING id INTO v_tower;
    RAISE NOTICE 'Created Tower H3 id=%', v_tower;
  ELSE
    RAISE NOTICE 'Tower H3 already exists id=%', v_tower;
  END IF;

  -- Floors under Tower H3
  SELECT id INTO v_gf  FROM eps_node WHERE "parentId" = v_tower AND name = 'GF';
  IF v_gf IS NULL THEN
    INSERT INTO eps_node (name, type, "parentId", "order", "createdBy", "updatedBy")
    VALUES ('GF', 'FLOOR', v_tower, 0, 'system', 'system') RETURNING id INTO v_gf;
  END IF;

  SELECT id INTO v_f1  FROM eps_node WHERE "parentId" = v_tower AND name = '1'  AND type='FLOOR';
  IF v_f1  IS NULL THEN INSERT INTO eps_node (name,type,"parentId","order","createdBy","updatedBy") VALUES ('1','FLOOR',v_tower,1,'system','system') RETURNING id INTO v_f1;  END IF;
  SELECT id INTO v_f2  FROM eps_node WHERE "parentId" = v_tower AND name = '2'  AND type='FLOOR';
  IF v_f2  IS NULL THEN INSERT INTO eps_node (name,type,"parentId","order","createdBy","updatedBy") VALUES ('2','FLOOR',v_tower,2,'system','system') RETURNING id INTO v_f2;  END IF;
  SELECT id INTO v_f3  FROM eps_node WHERE "parentId" = v_tower AND name = '3'  AND type='FLOOR';
  IF v_f3  IS NULL THEN INSERT INTO eps_node (name,type,"parentId","order","createdBy","updatedBy") VALUES ('3','FLOOR',v_tower,3,'system','system') RETURNING id INTO v_f3;  END IF;
  SELECT id INTO v_f4  FROM eps_node WHERE "parentId" = v_tower AND name = '4'  AND type='FLOOR';
  IF v_f4  IS NULL THEN INSERT INTO eps_node (name,type,"parentId","order","createdBy","updatedBy") VALUES ('4','FLOOR',v_tower,4,'system','system') RETURNING id INTO v_f4;  END IF;
  SELECT id INTO v_f5  FROM eps_node WHERE "parentId" = v_tower AND name = '5'  AND type='FLOOR';
  IF v_f5  IS NULL THEN INSERT INTO eps_node (name,type,"parentId","order","createdBy","updatedBy") VALUES ('5','FLOOR',v_tower,5,'system','system') RETURNING id INTO v_f5;  END IF;
  SELECT id INTO v_f6  FROM eps_node WHERE "parentId" = v_tower AND name = '6'  AND type='FLOOR';
  IF v_f6  IS NULL THEN INSERT INTO eps_node (name,type,"parentId","order","createdBy","updatedBy") VALUES ('6','FLOOR',v_tower,6,'system','system') RETURNING id INTO v_f6;  END IF;
  SELECT id INTO v_f7  FROM eps_node WHERE "parentId" = v_tower AND name = '7'  AND type='FLOOR';
  IF v_f7  IS NULL THEN INSERT INTO eps_node (name,type,"parentId","order","createdBy","updatedBy") VALUES ('7','FLOOR',v_tower,7,'system','system') RETURNING id INTO v_f7;  END IF;
  SELECT id INTO v_f8  FROM eps_node WHERE "parentId" = v_tower AND name = '8'  AND type='FLOOR';
  IF v_f8  IS NULL THEN INSERT INTO eps_node (name,type,"parentId","order","createdBy","updatedBy") VALUES ('8','FLOOR',v_tower,8,'system','system') RETURNING id INTO v_f8;  END IF;
  SELECT id INTO v_f9  FROM eps_node WHERE "parentId" = v_tower AND name = '9'  AND type='FLOOR';
  IF v_f9  IS NULL THEN INSERT INTO eps_node (name,type,"parentId","order","createdBy","updatedBy") VALUES ('9','FLOOR',v_tower,9,'system','system') RETURNING id INTO v_f9;  END IF;
  SELECT id INTO v_f10 FROM eps_node WHERE "parentId" = v_tower AND name = '10' AND type='FLOOR';
  IF v_f10 IS NULL THEN INSERT INTO eps_node (name,type,"parentId","order","createdBy","updatedBy") VALUES ('10','FLOOR',v_tower,10,'system','system') RETURNING id INTO v_f10; END IF;
  SELECT id INTO v_f11 FROM eps_node WHERE "parentId" = v_tower AND name = '11' AND type='FLOOR';
  IF v_f11 IS NULL THEN INSERT INTO eps_node (name,type,"parentId","order","createdBy","updatedBy") VALUES ('11','FLOOR',v_tower,11,'system','system') RETURNING id INTO v_f11; END IF;
  SELECT id INTO v_f12 FROM eps_node WHERE "parentId" = v_tower AND name = '12' AND type='FLOOR';
  IF v_f12 IS NULL THEN INSERT INTO eps_node (name,type,"parentId","order","createdBy","updatedBy") VALUES ('12','FLOOR',v_tower,12,'system','system') RETURNING id INTO v_f12; END IF;

  RAISE NOTICE 'EPS floors: GF=% 1=% 2=% 3=% 4=% 5=% 6=% 7=% 8=% 9=% 10=% 11=% 12=%',
    v_gf, v_f1, v_f2, v_f3, v_f4, v_f5, v_f6, v_f7, v_f8, v_f9, v_f10, v_f11, v_f12;

END $$;


-- ============================================================
-- PART 2 : WBS NODES  (mirror of Block 4, new codes under "2.")
-- ============================================================
DO $$
DECLARE
  -- old id → new id mapping stored here for activity insert
  -- Level 1
  v_root   INT;
  -- Level 2
  v_s1     INT;  -- Superstructure       (old wbs 3)
  v_s2     INT;  -- Internal Finishes    (old wbs 8)
  v_s3     INT;  -- Common Area Finishes (old wbs 27)
  v_s4     INT;  -- External painting    (old wbs 44)
  v_s5     INT;  -- External Development (old wbs 47)
  v_s6     INT;  -- De Snagging          (old wbs 48)
  -- Level 3 children of Superstructure
  v_s11    INT;  -- Structure Works Typical Floors  (old 4)
  v_s12    INT;  -- Structure - Above terrace       (old 5)
  v_s13    INT;  -- Terrace Finishing works          (old 6)
  v_s14    INT;  -- Terrace solar works              (old 7)
  -- Level 3 children of Internal Finishes (18 nodes)
  v_s21    INT;  -- Ceiling Painting                 (old  9)
  v_s22    INT;  -- Water Proofing incl Screed        (old 10)
  v_s23    INT;  -- gypsum                            (old 11)
  v_s24    INT;  -- Toilet dado                       (old 12)
  v_s25    INT;  -- Flooring                          (old 13)
  v_s26    INT;  -- Kitchen/Toilet Granite Counter    (old 14)
  v_s27    INT;  -- Windows & Ventilators             (old 15)
  v_s28    INT;  -- Main door fixing                  (old 16)
  v_s29    INT;  -- Bedroom & Toilet door fixing      (old 17)
  v_s210   INT;  -- Paint Internal 1st Coat           (old 18)
  v_s211   INT;  -- False Ceiling - Toilets           (old 19)
  v_s212   INT;  -- Grouting/acid wash                (old 20)
  v_s213   INT;  -- CP Fitting                        (old 21)
  v_s214   INT;  -- Paint Final-internal              (old 22)
  v_s215   INT;  -- Electrical GI Wire Pulling        (old 23)
  v_s216   INT;  -- Electrical Wiring                 (old 24)
  v_s217   INT;  -- Ceiling Pipes                     (old 25)
  v_s218   INT;  -- Fixing of Electrical              (old 26)
  -- Level 3 children of Common Area Finishes
  v_s31    INT;  -- Putty Works & Paint               (old 28)
  v_s32    INT;  -- Lobby Flooring                    (old 29)
  v_s33    INT;  -- Lobby windows fixing              (old 30)
  v_s34    INT;  -- Staircase                         (old 33)
  v_s35    INT;  -- Fire Door fixing                  (old 38)
  v_s36    INT;  -- MEP - Shafts                      (old 39)
  -- Level 3 children of External painting
  v_s41    INT;  -- Texture                           (old 45)
  v_s42    INT;  -- SECOND COAT PAINT                 (old 46)
  -- Level 4 under Lobby windows (s33)
  v_s3313  INT;  -- Lift                              (old 31)
  v_s3314  INT;  -- Lobby Cladding                    (old 32)
  -- Level 4 under Staircase (s34)
  v_s341   INT;  -- Staircase Railing work            (old 34)
  v_s342   INT;  -- Staircase flooring                (old 35)
  -- Level 4 under MEP Shafts (s36)
  v_s361   INT;  -- Shaft Verticals - Cable Tray      (old 40)
  v_s362   INT;  -- Terrace Lighting Arrestors        (old 41)
  v_s363   INT;  -- Shaft Plumbing Piping             (old 42)
  v_s364   INT;  -- Rain Water Piping                 (old 43)
  -- Level 5 under Staircase flooring (s342)
  v_s34214 INT;  -- Staircase Painting                (old 36)
  v_s34215 INT;  -- Staircase window fixing           (old 37)

BEGIN

  -- Idempotency: check if Block 3 WBS already created
  SELECT id INTO v_root FROM wbs_node WHERE project_id = 2 AND wbs_code = '2';
  IF v_root IS NOT NULL THEN
    RAISE NOTICE 'Block 3 WBS already exists (root id=%). Skipping WBS creation.', v_root;
    RETURN;
  END IF;

  -- ── LEVEL 1 : Root ──────────────────────────────────────────
  INSERT INTO wbs_node (project_id, wbs_code, wbs_name, wbs_level, sequence_no, status, created_by)
  VALUES (2, '2', 'Tower Block 3', 1, 2, 'ACTIVE', 'system') RETURNING id INTO v_root;

  -- ── LEVEL 2 ──────────────────────────────────────────────────
  INSERT INTO wbs_node (project_id, parent_id, wbs_code, wbs_name, wbs_level, sequence_no, status, created_by)
  VALUES (2, v_root, '2.1', 'Superstructure',           2, 1, 'ACTIVE', 'system') RETURNING id INTO v_s1;
  INSERT INTO wbs_node (project_id, parent_id, wbs_code, wbs_name, wbs_level, sequence_no, status, created_by)
  VALUES (2, v_root, '2.2', 'Internal Finishes',         2, 2, 'ACTIVE', 'system') RETURNING id INTO v_s2;
  INSERT INTO wbs_node (project_id, parent_id, wbs_code, wbs_name, wbs_level, sequence_no, status, created_by)
  VALUES (2, v_root, '2.3', 'Common Area Finishes',      2, 3, 'ACTIVE', 'system') RETURNING id INTO v_s3;
  INSERT INTO wbs_node (project_id, parent_id, wbs_code, wbs_name, wbs_level, sequence_no, status, created_by)
  VALUES (2, v_root, '2.4', 'External Painting',         2, 4, 'ACTIVE', 'system') RETURNING id INTO v_s4;
  INSERT INTO wbs_node (project_id, parent_id, wbs_code, wbs_name, wbs_level, sequence_no, status, created_by)
  VALUES (2, v_root, '2.5', 'External Development',      2, 5, 'ACTIVE', 'system') RETURNING id INTO v_s5;
  INSERT INTO wbs_node (project_id, parent_id, wbs_code, wbs_name, wbs_level, sequence_no, status, created_by)
  VALUES (2, v_root, '2.6', 'De Snagging & Hand Over',   2, 6, 'ACTIVE', 'system') RETURNING id INTO v_s6;

  -- ── LEVEL 3 : Superstructure children ────────────────────────
  INSERT INTO wbs_node (project_id,parent_id,wbs_code,wbs_name,wbs_level,sequence_no,status,created_by) VALUES (2,v_s1,'2.1.1','Structure Works Typical Floors',3,1,'ACTIVE','system') RETURNING id INTO v_s11;
  INSERT INTO wbs_node (project_id,parent_id,wbs_code,wbs_name,wbs_level,sequence_no,status,created_by) VALUES (2,v_s1,'2.1.2','Structure - Above Terrace',3,2,'ACTIVE','system') RETURNING id INTO v_s12;
  INSERT INTO wbs_node (project_id,parent_id,wbs_code,wbs_name,wbs_level,sequence_no,status,created_by) VALUES (2,v_s1,'2.1.3','Terrace Finishing Works',3,3,'ACTIVE','system') RETURNING id INTO v_s13;
  INSERT INTO wbs_node (project_id,parent_id,wbs_code,wbs_name,wbs_level,sequence_no,status,created_by) VALUES (2,v_s1,'2.1.4','Terrace Solar Works',3,4,'ACTIVE','system') RETURNING id INTO v_s14;

  -- ── LEVEL 3 : Internal Finishes children ─────────────────────
  INSERT INTO wbs_node (project_id,parent_id,wbs_code,wbs_name,wbs_level,sequence_no,status,created_by) VALUES (2,v_s2,'2.2.1','Ceiling Painting',3,1,'ACTIVE','system') RETURNING id INTO v_s21;
  INSERT INTO wbs_node (project_id,parent_id,wbs_code,wbs_name,wbs_level,sequence_no,status,created_by) VALUES (2,v_s2,'2.2.2','Water Proofing incl Screed Concrete',3,2,'ACTIVE','system') RETURNING id INTO v_s22;
  INSERT INTO wbs_node (project_id,parent_id,wbs_code,wbs_name,wbs_level,sequence_no,status,created_by) VALUES (2,v_s2,'2.2.3','Gypsum',3,3,'ACTIVE','system') RETURNING id INTO v_s23;
  INSERT INTO wbs_node (project_id,parent_id,wbs_code,wbs_name,wbs_level,sequence_no,status,created_by) VALUES (2,v_s2,'2.2.4','Toilet Dado',3,4,'ACTIVE','system') RETURNING id INTO v_s24;
  INSERT INTO wbs_node (project_id,parent_id,wbs_code,wbs_name,wbs_level,sequence_no,status,created_by) VALUES (2,v_s2,'2.2.5','Flooring at Living, Balcony, Toilets, Bedrooms & Utility',3,5,'ACTIVE','system') RETURNING id INTO v_s25;
  INSERT INTO wbs_node (project_id,parent_id,wbs_code,wbs_name,wbs_level,sequence_no,status,created_by) VALUES (2,v_s2,'2.2.6','Kitchen and Toilet Granite Counter',3,6,'ACTIVE','system') RETURNING id INTO v_s26;
  INSERT INTO wbs_node (project_id,parent_id,wbs_code,wbs_name,wbs_level,sequence_no,status,created_by) VALUES (2,v_s2,'2.2.7','Windows & Ventilators with Sliding Doors',3,7,'ACTIVE','system') RETURNING id INTO v_s27;
  INSERT INTO wbs_node (project_id,parent_id,wbs_code,wbs_name,wbs_level,sequence_no,status,created_by) VALUES (2,v_s2,'2.2.8','Main Door Fixing with Hardware',3,8,'ACTIVE','system') RETURNING id INTO v_s28;
  INSERT INTO wbs_node (project_id,parent_id,wbs_code,wbs_name,wbs_level,sequence_no,status,created_by) VALUES (2,v_s2,'2.2.9','Bed Room & Toilet Door Fixing',3,9,'ACTIVE','system') RETURNING id INTO v_s29;
  INSERT INTO wbs_node (project_id,parent_id,wbs_code,wbs_name,wbs_level,sequence_no,status,created_by) VALUES (2,v_s2,'2.2.10','Paint - Internal up to First Coat',3,10,'ACTIVE','system') RETURNING id INTO v_s210;
  INSERT INTO wbs_node (project_id,parent_id,wbs_code,wbs_name,wbs_level,sequence_no,status,created_by) VALUES (2,v_s2,'2.2.11','False Ceiling - Toilets',3,11,'ACTIVE','system') RETURNING id INTO v_s211;
  INSERT INTO wbs_node (project_id,parent_id,wbs_code,wbs_name,wbs_level,sequence_no,status,created_by) VALUES (2,v_s2,'2.2.12','Grouting / Acid Wash',3,12,'ACTIVE','system') RETURNING id INTO v_s212;
  INSERT INTO wbs_node (project_id,parent_id,wbs_code,wbs_name,wbs_level,sequence_no,status,created_by) VALUES (2,v_s2,'2.2.13','CP Fitting',3,13,'ACTIVE','system') RETURNING id INTO v_s213;
  INSERT INTO wbs_node (project_id,parent_id,wbs_code,wbs_name,wbs_level,sequence_no,status,created_by) VALUES (2,v_s2,'2.2.14','Paint Final - Internal',3,14,'ACTIVE','system') RETURNING id INTO v_s214;
  INSERT INTO wbs_node (project_id,parent_id,wbs_code,wbs_name,wbs_level,sequence_no,status,created_by) VALUES (2,v_s2,'2.2.15','Electrical GI Wire Pulling',3,15,'ACTIVE','system') RETURNING id INTO v_s215;
  INSERT INTO wbs_node (project_id,parent_id,wbs_code,wbs_name,wbs_level,sequence_no,status,created_by) VALUES (2,v_s2,'2.2.16','Electrical Wiring',3,16,'ACTIVE','system') RETURNING id INTO v_s216;
  INSERT INTO wbs_node (project_id,parent_id,wbs_code,wbs_name,wbs_level,sequence_no,status,created_by) VALUES (2,v_s2,'2.2.17','Ceiling Pipes',3,17,'ACTIVE','system') RETURNING id INTO v_s217;
  INSERT INTO wbs_node (project_id,parent_id,wbs_code,wbs_name,wbs_level,sequence_no,status,created_by) VALUES (2,v_s2,'2.2.18','Fixing of Electrical - Box, Switch Sockets',3,18,'ACTIVE','system') RETURNING id INTO v_s218;

  -- ── LEVEL 3 : Common Area Finishes children ───────────────────
  INSERT INTO wbs_node (project_id,parent_id,wbs_code,wbs_name,wbs_level,sequence_no,status,created_by) VALUES (2,v_s3,'2.3.1','Putty Works & Paint',3,1,'ACTIVE','system') RETURNING id INTO v_s31;
  INSERT INTO wbs_node (project_id,parent_id,wbs_code,wbs_name,wbs_level,sequence_no,status,created_by) VALUES (2,v_s3,'2.3.2','Lobby Flooring',3,2,'ACTIVE','system') RETURNING id INTO v_s32;
  INSERT INTO wbs_node (project_id,parent_id,wbs_code,wbs_name,wbs_level,sequence_no,status,created_by) VALUES (2,v_s3,'2.3.3','Lobby Windows Fixing',3,3,'ACTIVE','system') RETURNING id INTO v_s33;
  INSERT INTO wbs_node (project_id,parent_id,wbs_code,wbs_name,wbs_level,sequence_no,status,created_by) VALUES (2,v_s3,'2.3.4','Staircase',3,4,'ACTIVE','system') RETURNING id INTO v_s34;
  INSERT INTO wbs_node (project_id,parent_id,wbs_code,wbs_name,wbs_level,sequence_no,status,created_by) VALUES (2,v_s3,'2.3.5','Fire Door Fixing & Shaft Doors Fixing',3,5,'ACTIVE','system') RETURNING id INTO v_s35;
  INSERT INTO wbs_node (project_id,parent_id,wbs_code,wbs_name,wbs_level,sequence_no,status,created_by) VALUES (2,v_s3,'2.3.6','MEP - Shafts',3,6,'ACTIVE','system') RETURNING id INTO v_s36;

  -- ── LEVEL 3 : External Painting children ─────────────────────
  INSERT INTO wbs_node (project_id,parent_id,wbs_code,wbs_name,wbs_level,sequence_no,status,created_by) VALUES (2,v_s4,'2.4.1','Texture',3,1,'ACTIVE','system') RETURNING id INTO v_s41;
  INSERT INTO wbs_node (project_id,parent_id,wbs_code,wbs_name,wbs_level,sequence_no,status,created_by) VALUES (2,v_s4,'2.4.2','Second Coat Paint',3,2,'ACTIVE','system') RETURNING id INTO v_s42;

  -- ── LEVEL 4 : Lobby windows children ─────────────────────────
  INSERT INTO wbs_node (project_id,parent_id,wbs_code,wbs_name,wbs_level,sequence_no,status,created_by) VALUES (2,v_s33,'2.3.3.13','Lift',4,13,'ACTIVE','system') RETURNING id INTO v_s3313;
  INSERT INTO wbs_node (project_id,parent_id,wbs_code,wbs_name,wbs_level,sequence_no,status,created_by) VALUES (2,v_s33,'2.3.3.14','Lobby Cladding',4,14,'ACTIVE','system') RETURNING id INTO v_s3314;

  -- ── LEVEL 4 : Staircase children ──────────────────────────────
  INSERT INTO wbs_node (project_id,parent_id,wbs_code,wbs_name,wbs_level,sequence_no,status,created_by) VALUES (2,v_s34,'2.3.4.1','Staircase Railing Work',4,1,'ACTIVE','system') RETURNING id INTO v_s341;
  INSERT INTO wbs_node (project_id,parent_id,wbs_code,wbs_name,wbs_level,sequence_no,status,created_by) VALUES (2,v_s34,'2.3.4.2','Staircase Flooring',4,2,'ACTIVE','system') RETURNING id INTO v_s342;

  -- ── LEVEL 4 : MEP Shafts children ─────────────────────────────
  INSERT INTO wbs_node (project_id,parent_id,wbs_code,wbs_name,wbs_level,sequence_no,status,created_by) VALUES (2,v_s36,'2.3.6.1','Shaft Verticals - Cable Tray',4,1,'ACTIVE','system') RETURNING id INTO v_s361;
  INSERT INTO wbs_node (project_id,parent_id,wbs_code,wbs_name,wbs_level,sequence_no,status,created_by) VALUES (2,v_s36,'2.3.6.2','Terrace Lighting Arrestors',4,2,'ACTIVE','system') RETURNING id INTO v_s362;
  INSERT INTO wbs_node (project_id,parent_id,wbs_code,wbs_name,wbs_level,sequence_no,status,created_by) VALUES (2,v_s36,'2.3.6.3','Shaft Plumbing Piping',4,3,'ACTIVE','system') RETURNING id INTO v_s363;
  INSERT INTO wbs_node (project_id,parent_id,wbs_code,wbs_name,wbs_level,sequence_no,status,created_by) VALUES (2,v_s36,'2.3.6.4','Rain Water Piping',4,4,'ACTIVE','system') RETURNING id INTO v_s364;

  -- ── LEVEL 5 : Staircase flooring children ─────────────────────
  INSERT INTO wbs_node (project_id,parent_id,wbs_code,wbs_name,wbs_level,sequence_no,status,created_by) VALUES (2,v_s342,'2.3.4.2.14','Staircase Painting',5,14,'ACTIVE','system') RETURNING id INTO v_s34214;
  INSERT INTO wbs_node (project_id,parent_id,wbs_code,wbs_name,wbs_level,sequence_no,status,created_by) VALUES (2,v_s342,'2.3.4.2.15','Staircase Window Fixing',5,15,'ACTIVE','system') RETURNING id INTO v_s34215;

  RAISE NOTICE 'WBS created: root=% s1=% s2=% s3=% s4=% s5=% s6=%', v_root, v_s1, v_s2, v_s3, v_s4, v_s5, v_s6;

  -- ── ACTIVITIES : insert via mapping (old wbs_id → new wbs_id) ─
  -- Mapping: old → new
  -- wbs 2  → v_root  (root)
  -- wbs 3  → v_s1    wbs 8  → v_s2    wbs 27 → v_s3    wbs 44 → v_s4    wbs 47 → v_s5    wbs 48 → v_s6
  -- wbs 4  → v_s11   wbs 5  → v_s12   wbs 6  → v_s13   wbs 7  → v_s14
  -- wbs 9  → v_s21   wbs 10 → v_s22   wbs 11 → v_s23   wbs 12 → v_s24
  -- wbs 13 → v_s25   wbs 14 → v_s26   wbs 15 → v_s27   wbs 16 → v_s28
  -- wbs 17 → v_s29   wbs 18 → v_s210  wbs 19 → v_s211  wbs 20 → v_s212
  -- wbs 21 → v_s213  wbs 22 → v_s214  wbs 23 → v_s215  wbs 24 → v_s216
  -- wbs 25 → v_s217  wbs 26 → v_s218
  -- wbs 28 → v_s31   wbs 29 → v_s32   wbs 30 → v_s33   wbs 33 → v_s34
  -- wbs 38 → v_s35   wbs 39 → v_s36
  -- wbs 45 → v_s41   wbs 46 → v_s42
  -- wbs 31 → v_s3313 wbs 32 → v_s3314 wbs 34 → v_s341  wbs 35 → v_s342
  -- wbs 40 → v_s361  wbs 41 → v_s362  wbs 42 → v_s363  wbs 43 → v_s364
  -- wbs 36 → v_s34214 wbs 37 → v_s34215

  INSERT INTO activity (
    "projectId", "activityCode", "activityName", "activityType", status,
    "durationPlanned", "startDatePlanned", "finishDatePlanned",
    "startDateBaseline", "finishDateBaseline",
    "isMilestone", "percentComplete", "budgetedValue", "actualValue",
    wbs_node_id, "masterActivityId", "createdBy"
  )
  SELECT
    2,
    'B3-' || a."activityCode",
    a."activityName",
    a."activityType",
    'NOT_STARTED',
    a."durationPlanned",
    a."startDatePlanned"  + INTERVAL '6 months',
    a."finishDatePlanned" + INTERVAL '6 months',
    a."startDatePlanned"  + INTERVAL '6 months',
    a."finishDatePlanned" + INTERVAL '6 months',
    a."isMilestone",
    0,
    0,
    0,
    CASE a.wbs_node_id
      WHEN 2  THEN v_root
      WHEN 3  THEN v_s1    WHEN 8  THEN v_s2    WHEN 27 THEN v_s3
      WHEN 44 THEN v_s4    WHEN 47 THEN v_s5    WHEN 48 THEN v_s6
      WHEN 4  THEN v_s11   WHEN 5  THEN v_s12   WHEN 6  THEN v_s13   WHEN 7  THEN v_s14
      WHEN 9  THEN v_s21   WHEN 10 THEN v_s22   WHEN 11 THEN v_s23   WHEN 12 THEN v_s24
      WHEN 13 THEN v_s25   WHEN 14 THEN v_s26   WHEN 15 THEN v_s27   WHEN 16 THEN v_s28
      WHEN 17 THEN v_s29   WHEN 18 THEN v_s210  WHEN 19 THEN v_s211  WHEN 20 THEN v_s212
      WHEN 21 THEN v_s213  WHEN 22 THEN v_s214  WHEN 23 THEN v_s215  WHEN 24 THEN v_s216
      WHEN 25 THEN v_s217  WHEN 26 THEN v_s218
      WHEN 28 THEN v_s31   WHEN 29 THEN v_s32   WHEN 30 THEN v_s33   WHEN 33 THEN v_s34
      WHEN 38 THEN v_s35   WHEN 39 THEN v_s36
      WHEN 45 THEN v_s41   WHEN 46 THEN v_s42
      WHEN 31 THEN v_s3313 WHEN 32 THEN v_s3314
      WHEN 34 THEN v_s341  WHEN 35 THEN v_s342
      WHEN 40 THEN v_s361  WHEN 41 THEN v_s362  WHEN 42 THEN v_s363  WHEN 43 THEN v_s364
      WHEN 36 THEN v_s34214 WHEN 37 THEN v_s34215
      ELSE NULL
    END,
    a.id,
    'system'
  FROM activity a
  WHERE a."projectId" = 2
    AND NOT EXISTS (SELECT 1 FROM activity WHERE "projectId" = 2 AND "activityCode" = 'B3-' || a."activityCode");

  RAISE NOTICE 'Activities inserted for Block 3.';

END $$;


-- ============================================================
-- PART 3 : BOQ  (Total = ₹35,00,00,000 = 350,000,000)
-- ============================================================
DO $$
DECLARE
  -- BOQ item IDs
  v_boq1  INT;  -- Superstructure Works        140,000,000
  v_boq2  INT;  -- Internal Finishes           120,000,000
  v_boq3  INT;  -- Common Area Finishes         40,000,000
  v_boq4  INT;  -- External Painting            15,000,000
  v_boq5  INT;  -- External Development         25,000,000
  v_boq6  INT;  -- De Snagging & Handover       10,000,000

  -- Sub-item IDs for Superstructure
  v_si11  INT;  v_si12  INT;  v_si13  INT;  v_si14  INT;  v_si15  INT;

  -- Sub-item IDs for Internal Finishes
  v_si21  INT;  v_si22  INT;  v_si23  INT;  v_si24  INT;  v_si25  INT;
  v_si26  INT;  v_si27  INT;  v_si28  INT;  v_si29  INT;  v_si210 INT;
  v_si211 INT;  v_si212 INT;  v_si213 INT;  v_si214 INT;  v_si215 INT;
  v_si216 INT;  v_si217 INT;  v_si218 INT;

  -- Sub-item IDs for Common Area Finishes
  v_si31  INT;  v_si32  INT;  v_si33  INT;  v_si34  INT;  v_si35  INT;  v_si36  INT;

  -- Sub-item IDs for External Painting
  v_si41  INT;  v_si42  INT;

  -- Sub-item IDs for External Development
  v_si51  INT;  v_si52  INT;  v_si53  INT;

  -- Sub-item IDs for De Snagging
  v_si61  INT;  v_si62  INT;

  -- EPS node id for Block 3
  v_block3  INT := 407;

  -- Tower H3 and floor EPS ids (retrieved dynamically)
  v_tower   INT;
  v_gf  INT; v_f1 INT; v_f2 INT; v_f3 INT; v_f4 INT; v_f5 INT;
  v_f6  INT; v_f7 INT; v_f8 INT; v_f9 INT; v_f10 INT; v_f11 INT; v_f12 INT;

BEGIN

  -- Idempotency check
  IF EXISTS (SELECT 1 FROM boq_item WHERE "projectId" = 2 AND "boqCode" LIKE 'B3-BOQ-%') THEN
    RAISE NOTICE 'Block 3 BOQ already exists. Skipping BOQ creation.';
    RETURN;
  END IF;

  -- Retrieve floor EPS ids
  SELECT id INTO v_tower FROM eps_node WHERE "parentId" = 407 AND name = 'H3' AND type = 'TOWER';
  SELECT id INTO v_gf  FROM eps_node WHERE "parentId" = v_tower AND name = 'GF';
  SELECT id INTO v_f1  FROM eps_node WHERE "parentId" = v_tower AND name = '1'  AND type='FLOOR';
  SELECT id INTO v_f2  FROM eps_node WHERE "parentId" = v_tower AND name = '2'  AND type='FLOOR';
  SELECT id INTO v_f3  FROM eps_node WHERE "parentId" = v_tower AND name = '3'  AND type='FLOOR';
  SELECT id INTO v_f4  FROM eps_node WHERE "parentId" = v_tower AND name = '4'  AND type='FLOOR';
  SELECT id INTO v_f5  FROM eps_node WHERE "parentId" = v_tower AND name = '5'  AND type='FLOOR';
  SELECT id INTO v_f6  FROM eps_node WHERE "parentId" = v_tower AND name = '6'  AND type='FLOOR';
  SELECT id INTO v_f7  FROM eps_node WHERE "parentId" = v_tower AND name = '7'  AND type='FLOOR';
  SELECT id INTO v_f8  FROM eps_node WHERE "parentId" = v_tower AND name = '8'  AND type='FLOOR';
  SELECT id INTO v_f9  FROM eps_node WHERE "parentId" = v_tower AND name = '9'  AND type='FLOOR';
  SELECT id INTO v_f10 FROM eps_node WHERE "parentId" = v_tower AND name = '10' AND type='FLOOR';
  SELECT id INTO v_f11 FROM eps_node WHERE "parentId" = v_tower AND name = '11' AND type='FLOOR';
  SELECT id INTO v_f12 FROM eps_node WHERE "parentId" = v_tower AND name = '12' AND type='FLOOR';

  -- ══════════════════════════════════════════════════
  -- BOQ ITEM 1 : Superstructure Works  ₹14,00,00,000
  -- ══════════════════════════════════════════════════
  INSERT INTO boq_item ("projectId","boqCode",description,uom,"qtyMode",qty,rate,amount,"epsNodeId",status,"createdOn","updatedOn")
  VALUES (2,'B3-BOQ-01','Superstructure Works','LS','MANUAL',1,140000000,140000000,v_block3,'DRAFT',NOW(),NOW())
  RETURNING id INTO v_boq1;

  -- Sub-items for Superstructure
  INSERT INTO boq_sub_item ("boqItemId",description,uom,qty,rate,amount) VALUES (v_boq1,'Concrete Works (GF - 12th Floor)','CUM',7000,7000,49000000) RETURNING id INTO v_si11;
  INSERT INTO boq_sub_item ("boqItemId",description,uom,qty,rate,amount) VALUES (v_boq1,'Reinforcement Steel (Fe500)','MT',800,75000,60000000) RETURNING id INTO v_si12;
  INSERT INTO boq_sub_item ("boqItemId",description,uom,qty,rate,amount) VALUES (v_boq1,'Formwork (Aluminium / Conventional)','SQM',24000,750,18000000) RETURNING id INTO v_si13;
  INSERT INTO boq_sub_item ("boqItemId",description,uom,qty,rate,amount) VALUES (v_boq1,'Masonry Block Work','SQM',8000,1125,9000000) RETURNING id INTO v_si14;
  INSERT INTO boq_sub_item ("boqItemId",description,uom,qty,rate,amount) VALUES (v_boq1,'Structure Above Terrace (LMR / OHT / Parapet)','LS',1,4000000,4000000) RETURNING id INTO v_si15;

  -- Measurements for Concrete Works : one per floor (GF-12)
  INSERT INTO measurement_element ("projectId","boqItemId","boqSubItemId","epsNodeId","elementName","elementCategory","elementType",uom,qty,"importedOn")
  VALUES
    (2,v_boq1,v_si11,v_gf, 'GF Slab & Columns Concrete', 'Structural Concrete','RCC Slab','CUM',700,NOW()),
    (2,v_boq1,v_si11,v_f1, '1F Slab & Columns Concrete', 'Structural Concrete','RCC Slab','CUM',560,NOW()),
    (2,v_boq1,v_si11,v_f2, '2F Slab & Columns Concrete', 'Structural Concrete','RCC Slab','CUM',560,NOW()),
    (2,v_boq1,v_si11,v_f3, '3F Slab & Columns Concrete', 'Structural Concrete','RCC Slab','CUM',560,NOW()),
    (2,v_boq1,v_si11,v_f4, '4F Slab & Columns Concrete', 'Structural Concrete','RCC Slab','CUM',540,NOW()),
    (2,v_boq1,v_si11,v_f5, '5F Slab & Columns Concrete', 'Structural Concrete','RCC Slab','CUM',540,NOW()),
    (2,v_boq1,v_si11,v_f6, '6F Slab & Columns Concrete', 'Structural Concrete','RCC Slab','CUM',520,NOW()),
    (2,v_boq1,v_si11,v_f7, '7F Slab & Columns Concrete', 'Structural Concrete','RCC Slab','CUM',520,NOW()),
    (2,v_boq1,v_si11,v_f8, '8F Slab & Columns Concrete', 'Structural Concrete','RCC Slab','CUM',520,NOW()),
    (2,v_boq1,v_si11,v_f9, '9F Slab & Columns Concrete', 'Structural Concrete','RCC Slab','CUM',500,NOW()),
    (2,v_boq1,v_si11,v_f10,'10F Slab & Columns Concrete','Structural Concrete','RCC Slab','CUM',500,NOW()),
    (2,v_boq1,v_si11,v_f11,'11F Slab & Columns Concrete','Structural Concrete','RCC Slab','CUM',480,NOW()),
    (2,v_boq1,v_si11,v_f12,'12F Slab & Columns Concrete','Structural Concrete','RCC Slab','CUM',500,NOW());

  -- Measurements for Reinforcement Steel : one per floor
  INSERT INTO measurement_element ("projectId","boqItemId","boqSubItemId","epsNodeId","elementName","elementCategory","elementType",uom,qty,"importedOn")
  VALUES
    (2,v_boq1,v_si12,v_gf, 'GF Reinforcement Steel','Reinforcement','Fe500 Steel','MT',75,NOW()),
    (2,v_boq1,v_si12,v_f1, '1F Reinforcement Steel','Reinforcement','Fe500 Steel','MT',65,NOW()),
    (2,v_boq1,v_si12,v_f2, '2F Reinforcement Steel','Reinforcement','Fe500 Steel','MT',65,NOW()),
    (2,v_boq1,v_si12,v_f3, '3F Reinforcement Steel','Reinforcement','Fe500 Steel','MT',65,NOW()),
    (2,v_boq1,v_si12,v_f4, '4F Reinforcement Steel','Reinforcement','Fe500 Steel','MT',62,NOW()),
    (2,v_boq1,v_si12,v_f5, '5F Reinforcement Steel','Reinforcement','Fe500 Steel','MT',62,NOW()),
    (2,v_boq1,v_si12,v_f6, '6F Reinforcement Steel','Reinforcement','Fe500 Steel','MT',60,NOW()),
    (2,v_boq1,v_si12,v_f7, '7F Reinforcement Steel','Reinforcement','Fe500 Steel','MT',60,NOW()),
    (2,v_boq1,v_si12,v_f8, '8F Reinforcement Steel','Reinforcement','Fe500 Steel','MT',60,NOW()),
    (2,v_boq1,v_si12,v_f9, '9F Reinforcement Steel','Reinforcement','Fe500 Steel','MT',58,NOW()),
    (2,v_boq1,v_si12,v_f10,'10F Reinforcement Steel','Reinforcement','Fe500 Steel','MT',58,NOW()),
    (2,v_boq1,v_si12,v_f11,'11F Reinforcement Steel','Reinforcement','Fe500 Steel','MT',55,NOW()),
    (2,v_boq1,v_si12,v_f12,'12F Reinforcement Steel','Reinforcement','Fe500 Steel','MT',63,NOW());

  -- Measurements for Formwork : one per floor
  INSERT INTO measurement_element ("projectId","boqItemId","boqSubItemId","epsNodeId","elementName","elementCategory","elementType",uom,qty,"importedOn")
  VALUES
    (2,v_boq1,v_si13,v_gf, 'GF Formwork','Formwork','Aluminium Formwork','SQM',2200,NOW()),
    (2,v_boq1,v_si13,v_f1, '1F Formwork','Formwork','Aluminium Formwork','SQM',1850,NOW()),
    (2,v_boq1,v_si13,v_f2, '2F Formwork','Formwork','Aluminium Formwork','SQM',1850,NOW()),
    (2,v_boq1,v_si13,v_f3, '3F Formwork','Formwork','Aluminium Formwork','SQM',1850,NOW()),
    (2,v_boq1,v_si13,v_f4, '4F Formwork','Formwork','Aluminium Formwork','SQM',1850,NOW()),
    (2,v_boq1,v_si13,v_f5, '5F Formwork','Formwork','Aluminium Formwork','SQM',1850,NOW()),
    (2,v_boq1,v_si13,v_f6, '6F Formwork','Formwork','Aluminium Formwork','SQM',1850,NOW()),
    (2,v_boq1,v_si13,v_f7, '7F Formwork','Formwork','Aluminium Formwork','SQM',1850,NOW()),
    (2,v_boq1,v_si13,v_f8, '8F Formwork','Formwork','Aluminium Formwork','SQM',1850,NOW()),
    (2,v_boq1,v_si13,v_f9, '9F Formwork','Formwork','Aluminium Formwork','SQM',1800,NOW()),
    (2,v_boq1,v_si13,v_f10,'10F Formwork','Formwork','Aluminium Formwork','SQM',1800,NOW()),
    (2,v_boq1,v_si13,v_f11,'11F Formwork','Formwork','Aluminium Formwork','SQM',1800,NOW()),
    (2,v_boq1,v_si13,v_f12,'12F Formwork','Formwork','Aluminium Formwork','SQM',1850,NOW());

  -- Single measurements for Masonry and Above Terrace
  INSERT INTO measurement_element ("projectId","boqItemId","boqSubItemId","epsNodeId","elementName","elementCategory","elementType",uom,qty,"importedOn")
  VALUES
    (2,v_boq1,v_si14,v_block3,'Masonry Block Work - All Floors','Masonry','AAC Block','SQM',8000,NOW()),
    (2,v_boq1,v_si15,v_block3,'Structure Above Terrace (LMR+OHT+Parapet)','Structural','RCC','LS',1,NOW());

  -- ══════════════════════════════════════════════════
  -- BOQ ITEM 2 : Internal Finishes  ₹12,00,00,000
  -- ══════════════════════════════════════════════════
  INSERT INTO boq_item ("projectId","boqCode",description,uom,"qtyMode",qty,rate,amount,"epsNodeId",status,"createdOn","updatedOn")
  VALUES (2,'B3-BOQ-02','Internal Finishes','LS','MANUAL',1,120000000,120000000,v_block3,'DRAFT',NOW(),NOW())
  RETURNING id INTO v_boq2;

  INSERT INTO boq_sub_item ("boqItemId",description,uom,qty,rate,amount) VALUES (v_boq2,'Ceiling Painting','SQM',5200,230.77,1200000)       RETURNING id INTO v_si21;
  INSERT INTO boq_sub_item ("boqItemId",description,uom,qty,rate,amount) VALUES (v_boq2,'Water Proofing incl Screed Concrete','SQM',3200,1000,3200000)  RETURNING id INTO v_si22;
  INSERT INTO boq_sub_item ("boqItemId",description,uom,qty,rate,amount) VALUES (v_boq2,'Gypsum Plaster','SQM',4800,500,2400000)              RETURNING id INTO v_si23;
  INSERT INTO boq_sub_item ("boqItemId",description,uom,qty,rate,amount) VALUES (v_boq2,'Toilet Dado Tiling','SQM',2400,2000,4800000)          RETURNING id INTO v_si24;
  INSERT INTO boq_sub_item ("boqItemId",description,uom,qty,rate,amount) VALUES (v_boq2,'Flooring at Living, Balcony, Toilets, Bedrooms & Utility','SQM',8000,2500,20000000) RETURNING id INTO v_si25;
  INSERT INTO boq_sub_item ("boqItemId",description,uom,qty,rate,amount) VALUES (v_boq2,'Kitchen and Toilet Granite Counter','RFT',1800,2000,3600000) RETURNING id INTO v_si26;
  INSERT INTO boq_sub_item ("boqItemId",description,uom,qty,rate,amount) VALUES (v_boq2,'Windows & Ventilators with Sliding Doors','NOS',1000,25000,25000000) RETURNING id INTO v_si27;
  INSERT INTO boq_sub_item ("boqItemId",description,uom,qty,rate,amount) VALUES (v_boq2,'Main Door Fixing with Hardware','NOS',104,57692,6000000) RETURNING id INTO v_si28;
  INSERT INTO boq_sub_item ("boqItemId",description,uom,qty,rate,amount) VALUES (v_boq2,'Bed Room & Toilet Door Fixing','NOS',400,50000,20000000) RETURNING id INTO v_si29;
  INSERT INTO boq_sub_item ("boqItemId",description,uom,qty,rate,amount) VALUES (v_boq2,'Paint - Internal up to First Coat','SQM',14000,300,4200000) RETURNING id INTO v_si210;
  INSERT INTO boq_sub_item ("boqItemId",description,uom,qty,rate,amount) VALUES (v_boq2,'False Ceiling - Toilets','SQM',2000,1400,2800000)     RETURNING id INTO v_si211;
  INSERT INTO boq_sub_item ("boqItemId",description,uom,qty,rate,amount) VALUES (v_boq2,'Grouting / Acid Wash','SQM',8000,150,1200000)          RETURNING id INTO v_si212;
  INSERT INTO boq_sub_item ("boqItemId",description,uom,qty,rate,amount) VALUES (v_boq2,'CP Fitting (Complete Set)','SET',104,50000,5200000)     RETURNING id INTO v_si213;
  INSERT INTO boq_sub_item ("boqItemId",description,uom,qty,rate,amount) VALUES (v_boq2,'Paint Final - Internal','SQM',14000,400,5600000)        RETURNING id INTO v_si214;
  INSERT INTO boq_sub_item ("boqItemId",description,uom,qty,rate,amount) VALUES (v_boq2,'Electrical GI Wire Pulling','UNIT',104,30769,3200000)   RETURNING id INTO v_si215;
  INSERT INTO boq_sub_item ("boqItemId",description,uom,qty,rate,amount) VALUES (v_boq2,'Electrical Wiring (Concealed)','UNIT',104,43269,4500000) RETURNING id INTO v_si216;
  INSERT INTO boq_sub_item ("boqItemId",description,uom,qty,rate,amount) VALUES (v_boq2,'Ceiling Pipes (CPVC/Conduit)','UNIT',104,30769,3200000) RETURNING id INTO v_si217;
  INSERT INTO boq_sub_item ("boqItemId",description,uom,qty,rate,amount) VALUES (v_boq2,'Fixing of Electrical - Box, Switch Sockets','UNIT',104,37500,3900000) RETURNING id INTO v_si218;

  -- Measurements for Internal Finishes : aggregate per sub-item at block level
  INSERT INTO measurement_element ("projectId","boqItemId","boqSubItemId","epsNodeId","elementName","elementCategory","elementType",uom,qty,"importedOn")
  VALUES
    (2,v_boq2,v_si21, v_block3,'Ceiling Painting - All Units','Finishes','Paint','SQM',5200,NOW()),
    (2,v_boq2,v_si22, v_block3,'Water Proofing incl Screed - All Units','Finishes','Waterproofing','SQM',3200,NOW()),
    (2,v_boq2,v_si23, v_block3,'Gypsum Plaster - All Units','Finishes','Gypsum','SQM',4800,NOW()),
    (2,v_boq2,v_si24, v_block3,'Toilet Dado Tiling - All Units','Finishes','Tiling','SQM',2400,NOW()),
    (2,v_boq2,v_si25, v_block3,'Flooring - All Units','Finishes','Flooring','SQM',8000,NOW()),
    (2,v_boq2,v_si26, v_block3,'Kitchen/Toilet Granite Counter','Finishes','Granite','RFT',1800,NOW()),
    (2,v_boq2,v_si27, v_block3,'Windows & Ventilators - All Units','Finishes','Aluminium Windows','NOS',1000,NOW()),
    (2,v_boq2,v_si28, v_block3,'Main Door - All Units','Finishes','Main Door','NOS',104,NOW()),
    (2,v_boq2,v_si29, v_block3,'Bedroom & Toilet Doors - All Units','Finishes','Interior Door','NOS',400,NOW()),
    (2,v_boq2,v_si210,v_block3,'Internal Paint 1st Coat - All Units','Finishes','Paint','SQM',14000,NOW()),
    (2,v_boq2,v_si211,v_block3,'False Ceiling Toilets - All Units','Finishes','False Ceiling','SQM',2000,NOW()),
    (2,v_boq2,v_si212,v_block3,'Grouting/Acid Wash - All Units','Finishes','Grouting','SQM',8000,NOW()),
    (2,v_boq2,v_si213,v_block3,'CP Fittings - All Units','MEP','Sanitary Fittings','SET',104,NOW()),
    (2,v_boq2,v_si214,v_block3,'Paint Final Internal - All Units','Finishes','Paint','SQM',14000,NOW()),
    (2,v_boq2,v_si215,v_block3,'Electrical GI Wire - All Units','MEP','Electrical','UNIT',104,NOW()),
    (2,v_boq2,v_si216,v_block3,'Electrical Wiring - All Units','MEP','Electrical','UNIT',104,NOW()),
    (2,v_boq2,v_si217,v_block3,'Ceiling Pipes - All Units','MEP','Plumbing','UNIT',104,NOW()),
    (2,v_boq2,v_si218,v_block3,'Electrical Box/Switch Sockets - All Units','MEP','Electrical','UNIT',104,NOW());

  -- ══════════════════════════════════════════════════
  -- BOQ ITEM 3 : Common Area Finishes  ₹4,00,00,000
  -- ══════════════════════════════════════════════════
  INSERT INTO boq_item ("projectId","boqCode",description,uom,"qtyMode",qty,rate,amount,"epsNodeId",status,"createdOn","updatedOn")
  VALUES (2,'B3-BOQ-03','Common Area Finishes','LS','MANUAL',1,40000000,40000000,v_block3,'DRAFT',NOW(),NOW())
  RETURNING id INTO v_boq3;

  INSERT INTO boq_sub_item ("boqItemId",description,uom,qty,rate,amount) VALUES (v_boq3,'Putty Works & Paint - Common Areas','SQM',6000,1333.33,8000000)  RETURNING id INTO v_si31;
  INSERT INTO boq_sub_item ("boqItemId",description,uom,qty,rate,amount) VALUES (v_boq3,'Lobby Flooring (Granite/Kota)','SQM',1500,8000,12000000)          RETURNING id INTO v_si32;
  INSERT INTO boq_sub_item ("boqItemId",description,uom,qty,rate,amount) VALUES (v_boq3,'Lobby Windows Fixing','NOS',52,96153.85,5000000)                   RETURNING id INTO v_si33;
  INSERT INTO boq_sub_item ("boqItemId",description,uom,qty,rate,amount) VALUES (v_boq3,'Staircase (Railing + Flooring + Paint + Window)','LS',1,7000000,7000000) RETURNING id INTO v_si34;
  INSERT INTO boq_sub_item ("boqItemId",description,uom,qty,rate,amount) VALUES (v_boq3,'Fire Door & Shaft Doors Fixing','NOS',130,30769.23,4000000)         RETURNING id INTO v_si35;
  INSERT INTO boq_sub_item ("boqItemId",description,uom,qty,rate,amount) VALUES (v_boq3,'MEP Shafts (Cable Tray + Lighting + Plumbing + RWP)','LS',1,4000000,4000000) RETURNING id INTO v_si36;

  INSERT INTO measurement_element ("projectId","boqItemId","boqSubItemId","epsNodeId","elementName","elementCategory","elementType",uom,qty,"importedOn")
  VALUES
    (2,v_boq3,v_si31,v_block3,'Common Area Putty & Paint','Finishes','Paint','SQM',6000,NOW()),
    (2,v_boq3,v_si32,v_block3,'Lobby Flooring - All Floors','Finishes','Flooring','SQM',1500,NOW()),
    (2,v_boq3,v_si33,v_block3,'Lobby Windows - All Floors','Finishes','Aluminium Windows','NOS',52,NOW()),
    (2,v_boq3,v_si34,v_block3,'Staircase Works - Complete','Finishes','Staircase','LS',1,NOW()),
    (2,v_boq3,v_si35,v_block3,'Fire Doors & Shaft Doors','Finishes','Fire Door','NOS',130,NOW()),
    (2,v_boq3,v_si36,v_block3,'MEP Shaft Works','MEP','Electrical + Plumbing','LS',1,NOW());

  -- ══════════════════════════════════════════════════
  -- BOQ ITEM 4 : External Painting  ₹1,50,00,000
  -- ══════════════════════════════════════════════════
  INSERT INTO boq_item ("projectId","boqCode",description,uom,"qtyMode",qty,rate,amount,"epsNodeId",status,"createdOn","updatedOn")
  VALUES (2,'B3-BOQ-04','External Painting','LS','MANUAL',1,15000000,15000000,v_block3,'DRAFT',NOW(),NOW())
  RETURNING id INTO v_boq4;

  INSERT INTO boq_sub_item ("boqItemId",description,uom,qty,rate,amount) VALUES (v_boq4,'Texture Paint - External Facade','SQM',5000,1800,9000000)    RETURNING id INTO v_si41;
  INSERT INTO boq_sub_item ("boqItemId",description,uom,qty,rate,amount) VALUES (v_boq4,'Second Coat Exterior Paint','SQM',5000,1200,6000000)           RETURNING id INTO v_si42;

  INSERT INTO measurement_element ("projectId","boqItemId","boqSubItemId","epsNodeId","elementName","elementCategory","elementType",uom,qty,"importedOn")
  VALUES
    (2,v_boq4,v_si41,v_block3,'External Texture Paint - All Faces','Finishes','Texture Paint','SQM',5000,NOW()),
    (2,v_boq4,v_si42,v_block3,'External 2nd Coat Paint - All Faces','Finishes','Paint','SQM',5000,NOW());

  -- ══════════════════════════════════════════════════
  -- BOQ ITEM 5 : External Development  ₹2,50,00,000
  -- ══════════════════════════════════════════════════
  INSERT INTO boq_item ("projectId","boqCode",description,uom,"qtyMode",qty,rate,amount,"epsNodeId",status,"createdOn","updatedOn")
  VALUES (2,'B3-BOQ-05','External Development','LS','MANUAL',1,25000000,25000000,v_block3,'DRAFT',NOW(),NOW())
  RETURNING id INTO v_boq5;

  INSERT INTO boq_sub_item ("boqItemId",description,uom,qty,rate,amount) VALUES (v_boq5,'Landscaping & Softscape','LS',1,12000000,12000000) RETURNING id INTO v_si51;
  INSERT INTO boq_sub_item ("boqItemId",description,uom,qty,rate,amount) VALUES (v_boq5,'Paving, Pathways & Hardscape','SQM',4000,2000,8000000) RETURNING id INTO v_si52;
  INSERT INTO boq_sub_item ("boqItemId",description,uom,qty,rate,amount) VALUES (v_boq5,'Site Utilities (Drainage, Water Supply, STP)','LS',1,5000000,5000000) RETURNING id INTO v_si53;

  INSERT INTO measurement_element ("projectId","boqItemId","boqSubItemId","epsNodeId","elementName","elementCategory","elementType",uom,qty,"importedOn")
  VALUES
    (2,v_boq5,v_si51,v_block3,'Landscaping - Block 3 Periphery','External','Landscaping','LS',1,NOW()),
    (2,v_boq5,v_si52,v_block3,'Paving & Pathways - Block 3','External','Paving','SQM',4000,NOW()),
    (2,v_boq5,v_si53,v_block3,'Site Utilities - Block 3','External','Civil','LS',1,NOW());

  -- ══════════════════════════════════════════════════
  -- BOQ ITEM 6 : De Snagging & Handover  ₹1,00,00,000
  -- ══════════════════════════════════════════════════
  INSERT INTO boq_item ("projectId","boqCode",description,uom,"qtyMode",qty,rate,amount,"epsNodeId",status,"createdOn","updatedOn")
  VALUES (2,'B3-BOQ-06','De Snagging & Handover','LS','MANUAL',1,10000000,10000000,v_block3,'DRAFT',NOW(),NOW())
  RETURNING id INTO v_boq6;

  INSERT INTO boq_sub_item ("boqItemId",description,uom,qty,rate,amount) VALUES (v_boq6,'Snagging & Rectification Works','LS',1,7000000,7000000) RETURNING id INTO v_si61;
  INSERT INTO boq_sub_item ("boqItemId",description,uom,qty,rate,amount) VALUES (v_boq6,'Final Inspection, Documentation & Handover','LS',1,3000000,3000000) RETURNING id INTO v_si62;

  INSERT INTO measurement_element ("projectId","boqItemId","boqSubItemId","epsNodeId","elementName","elementCategory","elementType",uom,qty,"importedOn")
  VALUES
    (2,v_boq6,v_si61,v_block3,'Snagging Works - All Units & Common Areas','Finishing','Snagging','LS',1,NOW()),
    (2,v_boq6,v_si62,v_block3,'Final Handover Documentation','Admin','Handover','LS',1,NOW());

  RAISE NOTICE 'BOQ created: item1=% item2=% item3=% item4=% item5=% item6=%',
    v_boq1, v_boq2, v_boq3, v_boq4, v_boq5, v_boq6;
  RAISE NOTICE 'Total BOQ budget = ₹35,00,00,000 (350,000,000)';

END $$;


-- ============================================================
-- VERIFICATION SUMMARY
-- ============================================================
SELECT 'EPS nodes under Block 3' AS check_name,
       COUNT(*) AS count
FROM eps_node
WHERE "parentId" = 407
  OR "parentId" IN (SELECT id FROM eps_node WHERE "parentId" = 407);

SELECT 'WBS nodes for project 2' AS check_name, COUNT(*) AS count FROM wbs_node WHERE project_id = 2;

SELECT 'Activities for project 2' AS check_name, COUNT(*) AS count FROM activity WHERE "projectId" = 2;

SELECT 'BOQ items for Block 3' AS check_name, COUNT(*) AS count FROM boq_item WHERE "projectId" = 2 AND "boqCode" LIKE 'B3-%';

SELECT 'BOQ sub-items for Block 3' AS check_name, COUNT(*) AS count
FROM boq_sub_item WHERE "boqItemId" IN (SELECT id FROM boq_item WHERE "projectId" = 2 AND "boqCode" LIKE 'B3-%');

SELECT 'Measurement elements for Block 3' AS check_name, COUNT(*) AS count
FROM measurement_element WHERE "boqItemId" IN (SELECT id FROM boq_item WHERE "projectId" = 2 AND "boqCode" LIKE 'B3-%');

SELECT 'Total BOQ budget (₹)' AS check_name,
       TO_CHAR(SUM(amount), 'FM99,99,99,999') AS count
FROM boq_item WHERE "projectId" = 2 AND "boqCode" LIKE 'B3-%';

COMMIT;
