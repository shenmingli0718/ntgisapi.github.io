const cors = require('cors');  // 引入 cors 套件
const express = require('express');
//const cors = require('cors');  // 引入 cors 套件
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const fse = require('fs-extra');
const csvParser = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

// const mime = require('mime'); // MIME 類型解析庫

const app = express();

// 使用 express.json() 解析 JSON 請求主體
app.use(express.json());
// app.use('/static', express.static(path.join(__dirname, 'static')));


app.use(cors());  // 啟用 CORS,允許跨域訪問

///app.use(cors({
//  origin: '*', // 允許所有來源
//  methods: ['GET', 'POST'], // 允許的 HTTP 方法
//  allowedHeaders: ['Content-Type', 'Authorization'] // 允許的標頭
// }));

// 使用 express.json() 替代 body-parser
// 使用 express.json() 解析 JSON 請求主體
// app.use(express.json());

// 上傳照片的根目錄
const UPLOAD_DIR = path.resolve(__dirname, 'static', 'uploads');
const MAX_FOLDER_SIZE_MB = 400; // 設置資料夾容量上限 (以MB計算)

// 定義 CSV 文件路徑
// const CSV_FILE = 'newtpe_tourist_att.csv';
const CSV_FILE = path.join(__dirname, 'static', 'newtpe_tourist_att.csv');
// 英文欄位名稱與中文對應表
const fieldMapping = {
  Name: '景點名稱',            //1
  Zone: '景點所屬景區編號',     //2
  Toldescribe: '景點特色文字詳述',  //3
  Description: '景點特色文字簡述',  //4
  Tel: '景點服務電話',    //5
  Add: '景點地址',      //6
  Zipcode: '郵遞區號',  //7
  Travellinginfo: '交通資訊描述',     //8
  Opentime: '開放時間',     //9
  Map: '景點地圖介紹網址',      //10
  Gov: '景點管理權責單位代碼',    //11
  Px: '景點X座標',      //12
  Py: '景點Y座標',      //13
  Orgclass: '景點分類說明',       //14
  Class1: '景點分類代碼1',        //15
  Class2: '景點分類代碼2',        //16
  Class3: '景點分類代碼3',        //17
  Level: '古蹟分級',        //18
  Website: '景點網址',      //19
  Parkinginfo: '停車資訊',      //20
  Parkinginfo_px: '主要停車場X座標',   //21
  Parkinginfo_py: '主要停車場Y座標',   //22
  Ticketinfo: '景點票價資訊',     //23
  Remarks: '警告及注意事項',      //24
  Keyword: '搜尋關鍵字',     //25
  Changetime: '資料異動時間',     //26
};

// 讀取 CSV 文件的函數
const readCSV = async () => {
  return new Promise((resolve, reject) => {
    const records = [];
    fs.createReadStream(CSV_FILE)
      .pipe(csvParser())
      .on('data', (data) => records.push(data))
      .on('end', () => resolve(records))
      .on('error', (error) => reject(error));
  });
};

// 格式化當前時間
const getCurrentTimestamp = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd} ${hh}:${min}:${ss}`;
};

// 簡單的 GET 路由
app.get('/', (req, res) => {
    res.send('(互動式GIS) Hello, World! 114/02/08');
});

// 傳遞 newtpe_tourist_att.csv
app.get('/get_tourist_data', (req, res) => {
  const records = [];
  
  fs.createReadStream(CSV_FILE)
      .pipe(csvParser())  // ✅ Proper CSV parsing
      .on('data', (row) => {
          records.push(row);
      })
      .on('end', () => {
          res.json(records);  // ✅ Return structured JSON
      })
      .on('error', (error) => {
          console.error("新北觀光旅遊檔讀檔錯誤:", error);
          res.status(500).json({ error: '新北觀光旅遊檔讀檔錯誤' });
      });
});

// 確保上傳目錄存在
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR);
}

// 使用 multer 處理單個檔案上傳
const upload = multer({ storage: multer.memoryStorage() });
//const upload = multer({
//  storage: multer.memoryStorage(),
//  limits: {fileSize: 1 * 1024 * 1024}  // 1 MB limit
//});
// 計算資料夾大小
function getFolderSize(folderPath) {
    let totalSize = 0;

    const calculateSize = (directory) => {
        const files = fs.readdirSync(directory);

        files.forEach((file) => {
            const filePath = path.join(directory, file);
            const stats = fs.statSync(filePath);

            if (stats.isDirectory()) {
                calculateSize(filePath); // 遞迴計算子目錄大小
            } else if (stats.isFile()) {
                totalSize += stats.size;
            }
        });
    };

    calculateSize(folderPath);
    return totalSize / (1024 * 1024); // 返回大小，單位為 MB
}
//
app.post('/check_capacity_limit', express.urlencoded({ extended: true }), (req, res) => {
    const uploadChunks = parseFloat(req.body.uploadChunks || 0); // 新上傳檔案的大小 (MB)
    const folderSize = getFolderSize(UPLOAD_DIR); // 目前資料夾大小
    
    console.log(`UPLOAD_DIR: ${UPLOAD_DIR}`);
    console.log(`folderSize: ${folderSize}`);
    console.log(`MAX_FOLDER_SIZE_MB: ${MAX_FOLDER_SIZE_MB}`);
    
    if (folderSize >= MAX_FOLDER_SIZE_MB) {
        return res.status(400).json({ error: '上傳空間已滿，請聯繫伺服器管理員。' });
    }

    if ((folderSize + uploadChunks) > MAX_FOLDER_SIZE_MB) {
        return res.status(400).json({ error: '上傳大小及資料夾大小之總和超過容量上限，請刪除部分檔案後再嘗試。' });
    }

    res.json({ message: '空間充足，可以上傳。' });
});                 
//
app.post('/2024_aut_Python_proj', upload.single('fileChunk'), async (req, res) => {
    const { chunkIndex, fileName, totalChunks, subid } = req.body;
    const chunk = req.file;

    if (!chunk || !fileName || chunkIndex === undefined || totalChunks === undefined) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    // 確保檔案的臨時資料夾存在
    const tempDir = path.resolve(UPLOAD_DIR, fileName + "_tmp");
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
    }

    // 儲存當前分段到臨時資料夾
    const chunkPath = path.resolve(tempDir, `chunk_${chunkIndex}`);
    await fse.writeFile(chunkPath, chunk.buffer);

    // 如果這是最後一個區塊，進行合併
    //if (parseInt(chunkIndex) === parseInt(totalChunks) - 1) {
    if (parseInt(chunkIndex) === (parseInt(totalChunks) - 1)) {
        //在操作前，檢查並創建目錄
        const fs = require('fs');
        if (!fs.existsSync(path.resolve(UPLOAD_DIR, subid))) {
            fs.mkdirSync(path.resolve(UPLOAD_DIR, subid), { recursive: true });
        }
        
        const finalFilePath = path.resolve(UPLOAD_DIR, subid, fileName);
        const writeStream = fs.createWriteStream(finalFilePath);

        for (let i = 0; i < totalChunks; i++) {
            const chunkFilePath = path.resolve(tempDir, `chunk_${i}`);
            const data = await fse.readFile(chunkFilePath);
            writeStream.write(data);
            fs.unlinkSync(chunkFilePath); // 刪除臨時檔案
        }

        writeStream.end();
        fs.rmdirSync(tempDir); // 刪除臨時資料夾
        return res.json({ message: 'File upload complete!' });
    }

    res.json({ message: `Chunk ${chunkIndex} uploaded successfully.` });
});

//**
// API: 列出文件
app.get('/uploads', (req, res) => {
    const subid = req.query.id; // 獲取景点ID(subid)
    if (!subid) {
        return res.status(400).json({ error: '缺少必要的id参数' });
    }

    const folderPath = path.join(UPLOAD_DIR, subid);

    // 检查目錄是否存在
    if (!fs.existsSync(folderPath)) {
        return res.status(404).json({ error: '照片目錄不存在' });
    }

    // 讀取目錄内容並傳回照片目錄
    fs.readdir(folderPath, (err, files) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: '無法讀取照片目錄内容' });
        }
        // res.json(files);

        // 過濾掉系統檔案，如 .DS_Store 或其他不需要的文件
        const filteredFiles = files.filter(file => {
            // 檢查文件名是否不是以 . 開頭（隱藏文件）及排除特定的文件類型（如 .dmg
            //return !file.startsWith('.') && !file.endsWith('.dmg');
            return !file.startsWith('.');
        });

        res.json(filteredFiles);
    });
});

// API: 提供前端圖片預覽
app.get('/preview/:subid/:filename', (req, res) => {
  const { subid, filename } = req.params;
  
  // 確認檔案路徑
  const filePath = path.join(UPLOAD_DIR, subid, filename);

  // 檢查檔案是否存在
  if (!fs.existsSync(filePath)) {
      console.error(`檔案未找到: ${filePath}`);
      return res.status(404).send('檔案未找到');
  }

  // 設定適當的 MIME 類型
  const contentType = getContentType(filename);
  res.setHeader('Content-Type', contentType);

  // 直接回傳圖片
  res.sendFile(filePath);
});

// 輔助函式：根據檔案副檔名返回對應的 MIME 類型
function getContentType(filename) {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
      case '.jpg': case '.jpeg': return 'image/jpeg';
      case '.png': return 'image/png';
      case '.gif': return 'image/gif';
      case '.webp': return 'image/webp';
      default: return 'application/octet-stream';
  }
}

// API: 提供照片下載
app.get('/uploads/:subid/:filename', (req, res) => {
    const { subid, filename } = req.params;
    
    // 確認檔案路徑
    const filePath = path.join(UPLOAD_DIR, subid, filename);
    // const contentType = mime.getType(filePath);
    
    // 檢查檔案是否存在
    if (!fs.existsSync(filePath)) {
        console.error(`檔案未找到: ${filePath}`);
        return res.status(404).send('檔案未找到');
    }

    // 獲取 MIME 類型（可選）
    // const contentType = mime.getType(filePath);
    // console.log(`正在下載文件: ${filePath} | MIME 類型: ${contentType}`);

    // 強制下載檔案
    res.download(filePath, filename, (err) => {
        if (err) {
            console.error(`下載失敗: ${err.message}`);
            res.status(500).send('下載失敗');
        }
    });
});
//**
// 提供所有欄位名稱及內容
app.get('/api/get-fields', async (req, res) => {
  const { PlaceID } = req.query;

  try {
    const records = await readCSV();
    // const record = records.find((r) => r['PlaceID'] === PlaceID);
    const record = records.find((r) => r['Id'] === PlaceID);

    if (!record) {
      return res.status(404).json({ message: '未找到相關記錄' });
    }

    // 過濾掉 Id 欄位
    const fields = Object.keys(record)
      .filter((key) => key !== 'Id') // 排除 'Id'
      .map((key) => ({
        key,
        label: fieldMapping[key] || key,  // 映射到中文名稱
        content: record[key],             // 欄位內容  
    }));

    res.json({ fields });
  } catch (error) {
    console.error('讀取欄位時發生錯誤：', error);
    res.status(500).json({ message: '伺服器錯誤，請稍後再試。' });
  }
});

// 更新 CSV 的 API
app.post('/api/update-csv', async (req, res) => {
  const updates = req.body;

  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({ message: '請提供有效的更新數據！' });
  }

  try {
    const records = await readCSV();

    updates.forEach((update) => {
      const { field, content, PlaceID } = update;
      // const record = records.find((r) => r['PlaceID'] === PlaceID);
      const record = records.find((r) => r['Id'] === PlaceID);

      if (record) {
        record[field] = content;
        record['Changetime'] = getCurrentTimestamp();
      }
    });

    await createCsvWriter({
      path: CSV_FILE,
      header: Object.keys(records[0]).map((key) => ({ id: key, title: key })),
    }).writeRecords(records);

    res.json({ message: '資料已成功更新！若更改景點X、Y座標，需重新繪製地圖。'});
  } catch (error) {
    console.error('更新 CSV 文件時發生錯誤：', error);
    res.status(500).json({ message: '更新失敗，請稍後再試。' });
  }
});         
//**
// 获取端口（如果没有 PORT 环境变量，则使用默认端口 3000）
const PORT = process.env.PORT || 3000;
// 啟動伺服器
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
