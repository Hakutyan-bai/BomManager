-- 新增「贴片LED」分类 + 参数模板
-- 使用 INSERT OR IGNORE 保证幂等。

INSERT OR IGNORE INTO categories (id, name, code_prefix) VALUES
    (10, '贴片LED', 'LED');

INSERT OR IGNORE INTO category_attributes (category_id, name, type, unit, required, sort_order, options) VALUES
    (10, '颜色',     'select', '',  1, 1, '["红","绿","蓝","黄","白","橙","其他"]'),
    (10, '波长',     'number', 'nm', 0, 2, NULL),
    (10, '正向电压', 'number', 'V',  0, 3, NULL),
    (10, '正向电流', 'number', 'mA', 0, 4, NULL),
    (10, '封装',     'select', '',  0, 5, '["0402","0603","0805","1206","3528","5050","其他"]');
