-- 初始分类 + 参数模板 + 编码前缀
-- 使用 INSERT OR IGNORE 保证幂等，重复执行不会产生重复数据。

INSERT OR IGNORE INTO categories (id, name, code_prefix) VALUES
    (1, '电阻',   'R'),
    (2, '电容',   'C'),
    (3, '电感',   'L'),
    (4, '二极管', 'D'),
    (5, '三极管', 'T'),
    (6, 'MOSFET', 'Q'),
    (7, 'IC',     'U'),
    (8, '连接器', 'J'),
    (9, '其他',   'M');

-- 电阻
INSERT OR IGNORE INTO category_attributes (category_id, name, type, unit, required, sort_order, options) VALUES
    (1, '阻值', 'number', 'Ω', 1, 1, NULL),
    (1, '功率', 'number', 'W', 0, 2, NULL),
    (1, '精度', 'number', '%', 0, 3, NULL),
    (1, '封装', 'select', '',  0, 4, '["0402","0603","0805","1206","2512","轴向","其他"]');

-- 电容
INSERT OR IGNORE INTO category_attributes (category_id, name, type, unit, required, sort_order, options) VALUES
    (2, '容量',     'number', 'nF', 1, 1, NULL),
    (2, '额定电压', 'number', 'V',  0, 2, NULL),
    (2, '容差',     'number', '%',  0, 3, NULL),
    (2, '介质',     'select', '',   0, 4, '["X7R","X5R","C0G","Y5V","电解","其他"]'),
    (2, '封装',     'select', '',   0, 5, '["0402","0603","0805","1206","1210","径向","其他"]');

-- 电感
INSERT OR IGNORE INTO category_attributes (category_id, name, type, unit, required, sort_order, options) VALUES
    (3, '电感量',   'number', 'uH', 1, 1, NULL),
    (3, '额定电流', 'number', 'A',  0, 2, NULL),
    (3, '直流电阻', 'number', 'Ω',  0, 3, NULL),
    (3, '精度',     'number', '%',  0, 4, NULL),
    (3, '封装',     'select', '',   0, 5, '["0402","0603","0805","1206","贴片","其他"]');

-- 二极管
INSERT OR IGNORE INTO category_attributes (category_id, name, type, unit, required, sort_order, options) VALUES
    (4, '反向耐压', 'number', 'V', 1, 1, NULL),
    (4, '正向电流', 'number', 'A', 0, 2, NULL),
    (4, '正向压降', 'number', 'V', 0, 3, NULL),
    (4, '封装',     'select', '',  0, 4, '["SOD-323","SOD-123","SMA","SMB","DO-41","其他"]');

-- 三极管
INSERT OR IGNORE INTO category_attributes (category_id, name, type, unit, required, sort_order, options) VALUES
    (5, '类型',       'select', '', 0, 1, '["NPN","PNP"]'),
    (5, '集电极电流', 'number', 'A', 0, 2, NULL),
    (5, '集射极电压', 'number', 'V', 0, 3, NULL),
    (5, '封装',       'select', '', 0, 4, '["SOT-23","SOT-89","TO-92","TO-220","其他"]');

-- MOSFET
INSERT OR IGNORE INTO category_attributes (category_id, name, type, unit, required, sort_order, options) VALUES
    (6, '类型',     'select', '',  0, 1, '["N沟道","P沟道"]'),
    (6, '漏源电压', 'number', 'V', 0, 2, NULL),
    (6, '漏极电流', 'number', 'A', 0, 3, NULL),
    (6, '导通电阻', 'number', 'mΩ', 0, 4, NULL),
    (6, '封装',     'select', '',  0, 5, '["SOT-23","SOP-8","TO-220","TO-252","其他"]');

-- IC（不预设大量复杂字段，用户可后续自行增加）
INSERT OR IGNORE INTO category_attributes (category_id, name, type, unit, required, sort_order, options) VALUES
    (7, '型号描述', 'text',   '', 0, 1, NULL),
    (7, '封装',     'select', '', 0, 2, '["SOP-8","SOP-16","QFP","QFN","DIP","其他"]');

-- 连接器
INSERT OR IGNORE INTO category_attributes (category_id, name, type, unit, required, sort_order, options) VALUES
    (8, '引脚数', 'number', 'Pin', 0, 1, NULL),
    (8, '间距',   'number', 'mm',  0, 2, NULL),
    (8, '封装',   'select', '',    0, 3, '["SMD","直插","其他"]');

-- 其他：不预设参数，用户可后续自行增加
