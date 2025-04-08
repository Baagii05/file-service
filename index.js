const AWS = require('aws-sdk');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT_FILE_MANAGER || 5001;


app.use(cors());
app.use(express.json());


AWS.config.update({ 
  region: process.env.AWS_REGION || 'us-east-1',  
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY 
});

const s3 = new AWS.S3();


const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });


app.get('/list-files', async (req, res) => {
  const { folder, fileType } = req.query;
  try {
    const params = { 
      Bucket: process.env.AWS_BUCKET_NAME
    };
    
    if (folder) {
      params.Prefix = folder;
    }
    
    const data = await s3.listObjectsV2(params).promise();
    
    let files = data.Contents.map(file => ({
      key: file.Key,
      size: file.Size,
      lastModified: file.LastModified,
      url: `https://${process.env.AWS_BUCKET_NAME}.s3.amazonaws.com/${file.Key}`
    }));
    
    if (fileType) {
      files = files.filter(file => file.key.endsWith(fileType));
    }
    
    res.json(files);
  } catch (error) {
    console.error('Error fetching files:', error);
    res.status(500).json({ message: 'Error fetching files', error: error.message });
  }
});


app.get('/retrieve-files', async (req, res) => {
  try {
    const data = await s3.listObjectsV2({ Bucket: process.env.AWS_BUCKET_NAME }).promise();
    const files = data.Contents.map(file => ({
      key: file.Key,
      size: file.Size,
      lastModified: file.LastModified,
      url: `https://${process.env.AWS_BUCKET_NAME}.s3.amazonaws.com/${file.Key}`
    }));
    
    res.json(files);
  } catch (error) {
    console.error('Error retrieving files:', error);
    res.status(500).json({ message: 'Error retrieving files', error: error.message });
  }
});


app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const fileContent = fs.readFileSync(req.file.path);
    const folder = req.body.folder || '';
    
    d
    let key = req.file.originalname;
    if (folder) {
      
      const folderPath = folder.endsWith('/') ? folder : `${folder}/`;
      key = folderPath + req.file.originalname;
    }

    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key,
      Body: fileContent,
      ContentType: req.file.mimetype
    };

    
    const data = await s3.upload(params).promise();
    
    
    fs.unlinkSync(req.file.path);

    res.json({
      message: 'File uploaded successfully',
      file: {
        key: data.Key,
        location: data.Location,
        url: `https://${process.env.AWS_BUCKET_NAME}.s3.amazonaws.com/${data.Key}`
      }
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({ message: 'Error uploading file', error: error.message });
  }
});


app.delete('/delete/:key', async (req, res) => {
  try {
    const key = decodeURIComponent(req.params.key);
    
    const params = {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: key
    };

    await s3.deleteObject(params).promise();
    
    res.json({
      message: 'File deleted successfully',
      key: key
    });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({ message: 'Error deleting file', error: error.message });
  }
});


app.listen(PORT, () => console.log(`File Manager Service running on port ${PORT}`));