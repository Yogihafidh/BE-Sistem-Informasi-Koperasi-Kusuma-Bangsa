CREATE TYPE "SettingValueType" AS ENUM ('STRING', 'NUMBER', 'BOOLEAN', 'JSON');

ALTER TABLE "Setting"
ADD COLUMN "valueType" "SettingValueType" NOT NULL DEFAULT 'STRING';
