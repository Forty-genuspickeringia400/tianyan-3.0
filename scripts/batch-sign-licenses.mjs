import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const 表头别名 = {
  licenseId: ['licenseId', '授权编号'],
  ownerName: ['ownerName', '姓名'],
  contact: ['contact', '联系方式'],
  edition: ['edition', '版本'],
  allowedDevices: ['allowedDevices', '允许设备数'],
  deviceFingerprint: ['deviceFingerprint', '设备指纹'],
  issuedAt: ['issuedAt', '签发时间'],
  expiresAt: ['expiresAt', '到期时间'],
  gracePeriodHours: ['gracePeriodHours', '宽限期小时'],
  capabilityProfile: ['capabilityProfile', '能力档位'],
  chat: ['chat', '对话'],
  basicWorkflows: ['basicWorkflows', '基础工作流'],
  skillInstall: ['skillInstall', '技能安装'],
  taskControl: ['taskControl', '任务控制'],
  backgroundRun: ['backgroundRun', '后台运行'],
  evolutionAdmin: ['evolutionAdmin', '进化管理'],
  remoteExec: ['remoteExec', '远程执行'],
  federation: ['federation', '联邦协作'],
  selfUpdate: ['selfUpdate', '自更新'],
  configAdmin: ['configAdmin', '配置管理'],
  systemPromptView: ['systemPromptView', '系统提示词查看'],
  skillExport: ['skillExport', '技能导出'],
  auditView: ['auditView', '审计查看'],
  status: ['status', '状态'],
  signedLicenseFile: ['signedLicenseFile', '签名文件名'],
  publicKeyFile: ['publicKeyFile', '公钥文件名'],
  notes: ['notes', '备注'],
};

function 规范化布尔值(value, 默认值 = false) {
  if (typeof value === 'boolean') return value;
  if (value == null || value === '') return 默认值;
  const text = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'y', '是', '开', 'on'].includes(text)) return true;
  if (['false', '0', 'no', 'n', '否', '关', 'off'].includes(text)) return false;
  return 默认值;
}

function 稳定排序(value) {
  if (Array.isArray(value)) return value.map(稳定排序);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = 稳定排序(value[key]);
      return acc;
    }, {});
  }
  return value;
}

function 稳定序列化(value) {
  return JSON.stringify(稳定排序(value));
}

function 解析CSV行(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    const next = line[i + 1];
    if (ch === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  result.push(current);
  return result.map((item) => item.trim());
}

function 规范化表头(headers) {
  return headers.map((header) => {
    for (const [canonical, aliases] of Object.entries(表头别名)) {
      if (aliases.includes(header)) return canonical;
    }
    return header;
  });
}

function 读取CSV(csvPath) {
  const raw = fs.readFileSync(csvPath, 'utf8').replace(/^\uFEFF/, '');
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    throw new Error('CSV 内容不足，至少需要表头 + 1 行数据。');
  }

  const headers = 规范化表头(解析CSV行(lines[0]));
  return lines.slice(1).map((line, index) => {
    const values = 解析CSV行(line);
    const row = {};
    headers.forEach((header, i) => {
      row[header] = values[i] ?? '';
    });
    row.__line = index + 2;
    return row;
  });
}

function 构建License(row) {
  const deviceFingerprint = String(row.deviceFingerprint || '').trim();
  if (!deviceFingerprint) {
    throw new Error(`第 ${row.__line} 行缺少 deviceFingerprint / 设备指纹`);
  }
  if (/REPLACE_WITH_FINGERPRINT/i.test(deviceFingerprint) || /请替换为真实指纹/.test(deviceFingerprint)) {
    throw new Error(`第 ${row.__line} 行 deviceFingerprint 还是占位符，请先替换真实指纹`);
  }

  const license = {
    licenseId: row.licenseId,
    ownerName: row.ownerName,
    edition: row.edition,
    allowedDevices: Number(row.allowedDevices || 1),
    deviceFingerprints: [deviceFingerprint],
    issuedAt: row.issuedAt,
    expiresAt: row.expiresAt,
    gracePeriodHours: Number(row.gracePeriodHours || 0),
    capabilities: {
      chat: 规范化布尔值(row.chat),
      basicWorkflows: 规范化布尔值(row.basicWorkflows),
      skillInstall: 规范化布尔值(row.skillInstall),
      taskControl: 规范化布尔值(row.taskControl),
      backgroundRun: 规范化布尔值(row.backgroundRun),
      evolutionAdmin: 规范化布尔值(row.evolutionAdmin),
      remoteExec: 规范化布尔值(row.remoteExec),
      federation: 规范化布尔值(row.federation),
      selfUpdate: 规范化布尔值(row.selfUpdate),
      configAdmin: 规范化布尔值(row.configAdmin),
      systemPromptView: 规范化布尔值(row.systemPromptView),
      skillExport: 规范化布尔值(row.skillExport),
      auditView: 规范化布尔值(row.auditView),
    },
    policyVersion: '1.0.0',
    signature: '',
  };

  const requiredFields = ['licenseId', 'ownerName', 'edition', 'issuedAt', 'expiresAt'];
  for (const field of requiredFields) {
    if (!String(license[field] || '').trim()) {
      throw new Error(`第 ${row.__line} 行缺少 ${field}`);
    }
  }

  return license;
}

function 签名License(license, privateKeyPem) {
  const unsigned = { ...license };
  delete unsigned.signature;
  const payload = Buffer.from(稳定序列化(unsigned), 'utf8');
  const signature = crypto.sign(null, payload, privateKeyPem).toString('base64');
  return { ...unsigned, signature };
}

function 选择默认签发表路径() {
  const candidates = [
    'C:/Users/Administrator/Desktop/天衍3.0-批量试用授权签发表-中文版.csv',
    'C:/Users/Administrator/Desktop/agentx-license-batch.csv',
  ];
  return candidates.find((file) => fs.existsSync(file)) || candidates[0];
}

const 默认CSV路径 = 选择默认签发表路径();
const 默认私钥路径 = path.resolve(process.cwd(), 'agentx-3.0/.keys/agentx-license-private.pem');
const 默认输出目录 = 'C:/Users/Administrator/Desktop/天衍3.0-批量授权输出';

const [csvArg, privateKeyArg, outDirArg] = process.argv.slice(2);
const csvPath = path.resolve(csvArg || 默认CSV路径);
const privateKeyPath = path.resolve(privateKeyArg || 默认私钥路径);
const outDir = path.resolve(outDirArg || 默认输出目录);

if (!fs.existsSync(csvPath)) {
  console.error(`未找到签发表：${csvPath}`);
  process.exit(1);
}

if (!fs.existsSync(privateKeyPath)) {
  console.error(`未找到私钥：${privateKeyPath}`);
  console.error('请先生成密钥，命令：');
  console.error('node agentx-3.0/scripts/generate-license-keys.mjs agentx-3.0/.keys');
  process.exit(1);
}

const rows = 读取CSV(csvPath).filter((row) => String(row.status || '').trim().toLowerCase() !== 'skip');
if (rows.length === 0) {
  console.error('签发表里没有可处理的数据行。');
  process.exit(1);
}

const privateKeyPem = fs.readFileSync(privateKeyPath, 'utf8');
fs.mkdirSync(outDir, { recursive: true });

const manifest = [];
let successCount = 0;
let failCount = 0;

for (const row of rows) {
  try {
    const license = 构建License(row);
    const signed = 签名License(license, privateKeyPem);
    const outFileName = row.signedLicenseFile?.trim() || `${license.licenseId}.json`;
    const outPath = path.join(outDir, outFileName);
    fs.writeFileSync(outPath, JSON.stringify(signed, null, 2), 'utf8');

    manifest.push({
      line: row.__line,
      licenseId: license.licenseId,
      ownerName: license.ownerName,
      edition: license.edition,
      expiresAt: license.expiresAt,
      status: 'success',
      outFile: outPath,
      notes: row.notes || '',
    });
    successCount += 1;
    console.log(`✅ 已签发：${license.ownerName} -> ${outPath}`);
  } catch (error) {
    manifest.push({
      line: row.__line,
      licenseId: row.licenseId || '',
      ownerName: row.ownerName || '',
      edition: row.edition || '',
      expiresAt: row.expiresAt || '',
      status: 'failed',
      outFile: '',
      notes: error.message,
    });
    failCount += 1;
    console.log(`❌ 第 ${row.__line} 行失败：${error.message}`);
  }
}

const manifestPath = path.join(outDir, '签发结果清单.json');
fs.writeFileSync(manifestPath, JSON.stringify({
  ok: failCount === 0,
  csvPath,
  privateKeyPath,
  outDir,
  successCount,
  failCount,
  results: manifest,
}, null, 2), 'utf8');

console.log('');
console.log('========== 批量签发完成 ==========');
console.log(`签发表：${csvPath}`);
console.log(`输出目录：${outDir}`);
console.log(`成功：${successCount}`);
console.log(`失败：${failCount}`);
console.log(`结果清单：${manifestPath}`);

if (failCount > 0) {
  process.exit(2);
}
