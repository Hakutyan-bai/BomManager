-- 物料中心 · 第一阶段表结构
-- 设计原则：分类与参数均存于数据库，不写死在代码中。
-- 未来可在此基础上新增 inventory / warehouses / locations / inventory_transactions，
-- 通过 materials.id 关联，不会被当前结构阻碍。

-- 1. 物料分类
CREATE TABLE categories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL UNIQUE,
    code_prefix TEXT    NOT NULL DEFAULT 'M',          -- 物料编码前缀，可扩展；空值按 M 处理
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 2. 分类参数定义（某分类有哪些参数）
CREATE TABLE category_attributes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name        TEXT    NOT NULL,
    type        TEXT    NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'number', 'select')),
    unit        TEXT    NOT NULL DEFAULT '',
    required    INTEGER NOT NULL DEFAULT 0 CHECK (required IN (0, 1)),
    sort_order  INTEGER NOT NULL DEFAULT 0,
    options     TEXT,                                 -- type = select 时的选项，JSON 数组字符串
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (category_id, name)
);

CREATE INDEX idx_category_attributes_category ON category_attributes (category_id, sort_order);

-- 3. 物料基本信息（软删除）
CREATE TABLE materials (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    code        TEXT    NOT NULL UNIQUE,              -- 系统自动生成，不可手动指定
    name        TEXT    NOT NULL,
    category_id INTEGER NOT NULL REFERENCES categories(id),
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    deleted_at  TEXT                                 -- NULL = 正常；非 NULL = 已删除
);

CREATE INDEX idx_materials_category ON materials (category_id);
CREATE INDEX idx_materials_deleted ON materials (deleted_at);
CREATE INDEX idx_materials_name ON materials (name);

-- 4. 物料参数值（某物料对某参数的一个值）
CREATE TABLE material_attributes (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    material_id  INTEGER NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
    attribute_id INTEGER NOT NULL REFERENCES category_attributes(id),
    value        TEXT    NOT NULL DEFAULT '',
    created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (material_id, attribute_id)
);

CREATE INDEX idx_material_attributes_material ON material_attributes (material_id);
CREATE INDEX idx_material_attributes_attribute ON material_attributes (attribute_id);
