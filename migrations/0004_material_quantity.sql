-- 物料剩余数量（件）；后续入库/出库功能在此基础上增减。
ALTER TABLE materials ADD COLUMN quantity INTEGER NOT NULL DEFAULT 0;
