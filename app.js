// Charder 身體組成儀 API for LINE 和 Charder

// 小D Z72Abe0c9c9d36e011c0e556bd2047819
// 小C W72Abe0c9c9d36e011c0e556bd2047819
// 小B V72Abe0c9c9d36e011c0e556bd2047819
// 小A U72Abe0c9c9d36e011c0e556bd2047819

var version ="V0.1";
var charderAPIKEY = "LAotO6ljsV7rPLiT";

var express = require('express');
var request = require("request");
var app = express();
var port = process.env.PORT || 5000

var response;
//var api_response;
//var cmd_response;
//var status_response;
var inputParam;
var memberData = [];
var memberAlreadyExist = false;

var 機器管理;
var 量測紀錄;
var 量測最後編號;
var 量測要求;
var 量測要求歷史;
var 健身房列表;


console.log("Version:", version);

// Firebase 設定
var admin = require("firebase-admin");

var serviceAccount = require("./charder-bodycomposition-bb529-firebase-adminsdk-m13xs-bc8690ead4.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://bodycomposition-bb529.firebaseio.com/"
});

var database = admin.database(); // 初始資料庫
// Firebase 設定結束

// express 設定
//app.use(function (req, res, next) {
//  res.header("Access-Control-Allow-Origin", "*");
//  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
//  next()
//});

app.use(function (req, res, next) {
//  res.header("Access-Control-Allow-Origin", "*");
//  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept"); 
//  res.header("Access-Control-Allow-Methods", "POST, GET, PUT, DELETE, OPTIONS");  
//  res.header("Access-Control-Allow-Credentials", false);   
//  res.header("Access-Control-Max-Age", "86400"); 
  res.header('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
      var headers = {};
      headers["Access-Control-Allow-Origin"] = "*";
      headers["Access-Control-Allow-Headers"]="Origin, X-Requested-With, Content-Type, Accept";     
      headers["Access-Control-Allow-Methods"] = "POST, GET, PUT, DELETE, OPTIONS";
      headers["Access-Control-Allow-Credentials"] = false;
      headers["Access-Control-Max-Age"] = '86400'; // 24 hours
      res.writeHead(200, headers);
     res.end();
  } else if (req.is('json') || req.is('text/*') ) { // 將 POST 的 data 串 起來
    req.data = '';
    req.setEncoding('utf8');
    req.on('data', function(chunk){ req.data += chunk });
    req.on('end', next);
  } else {
    next();
  }   
});

// APIs for LINE app
app.get('/', async function (req, res) {
  //console.log(req.query);
  inputParam = req.query;
  var response = res; // use local variable 避免重入衝突

  // 若無 API 參數，無效退出
  if (typeof inputParam.API == "undefined") {
    console.log("Error: No API");
    response.send("Error: No API");
    return 0;
  }   
  
  //console.log("API is ", inputParam.API);
  
  switch(inputParam.API) {
    case "00":
      console.log("呼叫 API:00 Keep Alive");
      response.send(keepAlive()); 
      //checkMember();
      break;
    case "01":
      console.log("呼叫 API:01 加入會員");
      response.send(addMember());
      break; 
    case "02":
      console.log("呼叫 API:02 更新資料");
      response.send(updateMember());  
      break;        
//    case "10":
//      console.log("呼叫 API:10 讀取 機器對應表");
//      readMachineTable();  
//      break; 
    case "14":
      console.log("呼叫 API:14 讀取 user profile");
      response.send(await getUserProfile());
      break;            
    case "20": 
      // inputParam: UserId, CustometId, StoreId
      console.log("呼叫 API:20 要求量測");
      response.send(await requestMeasurement());  
      break;
    case "21": 
      // inputParam: UserId, CustometId, StoreId
      console.log("呼叫 API:21 取消量測");
      response.send(await cancelMeasurement());  
      break;      
    case "22": 
      // inputParam: UserId, CustometId, StoreId
      console.log("呼叫 API:22 要求量測狀態");
      response.send(await requestMeasurementStatus());  
      break;
    case "30": 
      // inputParam: CustometId
      console.log("呼叫 API:30 取得健身房列表");
      response.send(getStoreList());
      break;  
    case "31": 
      // inputParam: CustometId, StoreId
      console.log("呼叫 API:31 取得機器序號");
      response.send(getMachineId());
      break;
    case "32": 
      // inputParam: UserId
      console.log("呼叫 API:32 依使用者編號取得量測紀錄");
      response.send(await 依使用者編號取得量測紀錄());
      break;   
    case "33": 
      // inputParam: UserId
      console.log("呼叫 API:33 依機器序號取得量測紀錄");
      response.send(依機器序號取得量測紀錄());
      break;      
    default:
      console.log("呼叫 未知API:"+inputParam.API);
      response.send("呼叫 未知API:"+inputParam.API);
  }

});

// 量測要求狀態及對應 command(for machine)
// 1.  量測要求狀態:"等待機器回應"    ==> 等待機器 get cmd:"select"
// 1.1 量測要求狀態:"等待機器選擇"    ==> 等待機器 post 回 status:"select_comfirmed"
// 2.  量測要求狀態:"等待機器要求資料" ==> 等待機器 get cmd:"user_info"   
// 2.1 量測要求狀態:"等待機器確認資料" ==> 等待機器 post 回 status:"user_info_comfirmed"
// 2.2 量測要求狀態:"等待機器登入     ==> 等待機器 post 回"status:"logged_in"
// 3.  量測要求狀態:"等待啟動量測體重" ==> 等待機器 get cmd:"start_weight_measurement"
// 4.  量測要求狀態:"XXXX"          ==> 根據機器 POST 資料更新 轉中文?
// 5.  量測要求狀態:"XXXX"          ==> 等待機器 POST 量測資料及圖片  
// 6.  量測要求狀態:"量測完成"       ==> 將量測要求 轉到 量測要求歷史, 機器狀態 改為 "上線"
// APIs for Charder GET ?X-API-KEY=LAotO6ljsV7rPLiT&Device_id=T00000001
var Device_id;
app.get('/cmd', async function (req, res) {
  console.log("呼叫 CMD API");
  
  inputParam = req.query;
  response = res;
  
  // verify X-API-KEY
  console.log(inputParam.XAPIKEY);    
  var XAPIKEY = inputParam.XAPIKEY;
  console.log(XAPIKEY);  
  
  if (XAPIKEY != charderAPIKEY) {
    console.log("XAPIKEY not correct");    
    response.send("XAPIKEY not correct");
    return 1;
  }
  
  // verify Device_id
  Device_id = inputParam.Device_id;   
  console.log(Device_id);
  if (Device_id==undefined || Device_id[0] != "T" || Device_id.length !=9 ) {
    console.log("Device_id not valid");    
    response.send("Device_id not valid");
    return 1;
  }
  
  // 檢查 Device 是否有量測要求
  if (量測要求[Device_id]==undefined){
    console.log("Device_id has no measurement request");
    dataToResponse={
      "Timestamp": Date.now(),
      "cmd": "",
    }    
    response.send(dataToResponse);
    return 1;    
  }  
  
  console.log("機器狀態:", 量測要求[Device_id][5]);
  var 量測要求機器狀態 = 量測要求[Device_id][5];
  var 健身房名稱 = 量測要求[Device_id][3];  
  var 店面名稱   = 量測要求[Device_id][4]; 
  var 報告編號   = 量測要求[Device_id][0];   
  var userId   = 量測要求[Device_id][2];
  
  var dataToResponse;
  switch(量測要求機器狀態) {
    // 1.  量測要求狀態:"等待機器回應"    ==> 等待機器 get cmd:"select"      
    case "等待機器回應":
      dataToResponse={
        "Timestamp": Date.now(),
        "cmd": "select",
      }
      
      // Move to the next state
      量測要求[Device_id][5]="等待機器選擇";
      //console.log(量測要求);
      await 更新資料庫量測要求();
      
      // 設定機器管理的機器狀態
      機器管理[健身房名稱][店面名稱].狀態更新時間 = Date.now();
      機器管理[健身房名稱][店面名稱].機器狀態 = "使用中"; 
      await 更新資料庫機器管理();
      break;
     
    // 1.1 量測要求狀態:"等待機器選擇"    ==> 等待機器 post 回 status:"select_comfirmed"
    // 2.  量測要求狀態:"等待機器要求資料" ==> 等待機器 get cmd:"user_info"       
    //case "等待機器選擇":  // 測試用，這是 POST 才會遇到的狀態
    case "等待機器要求資料":
      var userProfile = await 讀取會員資料(userId);
      
      var nowDate  = new Date();
      var thisYear = nowDate.getYear();
      var gender   = (userProfile[1]=="女")? "Female":"Male";
      console.log(userProfile);      
      dataToResponse={
        "Timestamp": Date.now(),
        "cmd": "user_info",
        "LINE-ID": userId,
        "name": userProfile[0],
        "Height": userProfile[8],   
        "Age": String((thisYear - userProfile[2])+1900), 
        "Gender": gender,
        "Ethnic": "Taiwanese",
        "dev_mac": "S/N"
      }
      
      console.log(dataToResponse);
      
      // Move to the next state
      量測要求[Device_id][5]="等待機器確認資料";
      console.log(量測要求);
      await 更新資料庫量測要求();      
      
      break; 
      
    // 2.1 量測要求狀態:"等待機器確認資料" ==> 等待機器 post 回 status:"user_info_comfirmed"
    // 2.2 量測要求狀態:"等待機器登入     ==> 等待機器 post 回"status:"logged_in"
    // 3.  量測要求狀態:"等待啟動量測體重" ==> 等待機器 get cmd:"start_weight_measurement"      
    //case "等待機器確認資料":  // 測試用，這是 POST 才會遇到的狀態
    case "等待機器登入":     // 測試用，這是 POST 才會遇到的狀態
    case "等待啟動量測體重": 
      dataToResponse={
        "Timestamp": Date.now(),
        "cmd": "start_weight_measurement",
      }

      console.log(dataToResponse);

      // Move to the next state
      量測要求[Device_id][5]="開始量測體重";
      console.log(量測要求);
      await 更新資料庫量測要求();        
      break;
      
    // 量測要求狀態
    //case "量測要求狀態": 
    case "開始量測體重":
    case "體重量測完成":
    case "檢查級板":
    case "檢查級板 OK":  
    case "身體組成量測":
    case "身體組成量測完成":
      dataToResponse={
        "Timestamp": Date.now(),
        "cmd": "", //只能接受 "取消" 和 ""
      }

      console.log(dataToResponse);
      // "量測要求狀態" 不變
      
      break;
      // 以下步驟由機器呼叫 POST 完成
      // 4.  量測要求狀態:"XXXX"          ==> 根據機器 POST 資料更新 轉中文?
      // 5.  量測要求狀態:"XXXX"          ==> 等待機器 POST 量測資料及圖片  
      // 6.  量測要求狀態:"量測完成"       ==> 將量測要求 轉到 量測要求歷史, 機器狀態 改為 "上線"     
      
    case "要求取消":
      dataToResponse={
        "Timestamp": Date.now(),
        "cmd": "cancel", //只能接受 "取消" 和 ""
      }      
      break;
      
    default:
      console.log("機器狀態:",量測要求機器狀態);
      dataToResponse={
        "Timestamp": Date.now(),
        "cmd": "", 
      }
  }  
    
  response.send(dataToResponse);  
  
});

// APIs for Charder POST ?X-API-KEY=LAotO6ljsV7rPLiT&Device_id=T00000001
app.post('/status', async function (req, res) {
  inputParam = req.query;
  response = res;
     
  // verify X-API-KEY
  //console.log(inputParam.XAPIKEY);    
  var XAPIKEY = inputParam.XAPIKEY;
  //console.log(XAPIKEY);  
  
  if (XAPIKEY != charderAPIKEY) {
    console.log("XAPIKEY not correct");    
    response.send("XAPIKEY not correct");
    return 1;
  }
  
  // verify Device_id
  Device_id = inputParam.Device_id;   
  //console.log(Device_id);
  if (Device_id==undefined || Device_id[0] != "T" || Device_id.length !=9 ) {
    console.log("Device_id not valid");    
    response.send("Device_id not valid");
    return 1;
  }
  
  
  //console.log("收到Post data: ", req.data);
  var postData = JSON.parse(req.data);
  var 機器狀態 = postData.status;
  var 時間戳記 = postData.Timestamp;
  var 機器序號 = postData.SN || "";
  var 量測報告 = postData.data || "";
  var 量測圖片 = postData.picture || "";
  
  //console.log(機器狀態, 時間戳記, 機器序號, 量測報告, 量測圖片.length);
  switch(機器狀態) {
      
    // 量測完成
    case "bodycomposition_analysis_results":
      console.log("bodycomposition_analysis_results");
      
      // 處理回傳資料 postData.data

      //console.log(量測報告);
      //console.log(量測圖片.length);
      
      var checkSum=0;
      for (i=0;i<量測圖片.length; i++) {
        checkSum+= 量測圖片.charCodeAt(i);
      }
      
      //console.log(String(checkSum));
      
      break;      
    default:
      console.log("不是 bodycomposition_analysis_results");
      response.send("Error: Only accept bodycomposition_analysis_results");     
      return;
  }

  console.log("圖片長度:"+String(量測圖片.length)+", Checksum:"+String(checkSum));  
  response.send("圖片長度:"+String(量測圖片.length)+", Checksum:"+String(checkSum));
  
});

app.listen(port, function () {
  console.log('App listening on port: ', port);
});
// express 設定結束

//initFromDatabase();

// 讀取資料庫 店面，機器 狀況
async function initFromDatabase(){
  await database.ref("機器管理").once("value").then(function (snapshot) {
    //console.log(snapshot.val());
    console.log("資料庫機器管理讀取完成");
    機器管理 = snapshot.val();    
  });
  
  await database.ref("量測紀錄").once("value").then(function (snapshot) {
    //console.log(snapshot.val());
    console.log("資料庫量測紀錄讀取完成");
    量測紀錄 = snapshot.val();   
    if (量測紀錄==undefined) 量測紀錄={};  
    if (量測紀錄.紀錄所有編號 == undefined)    量測紀錄.紀錄所有編號=[];
    if (量測紀錄.紀錄依使用者編號 == undefined) 量測紀錄.紀錄依使用者編號={};    
    if (量測紀錄.紀錄依機器序號 == undefined)   量測紀錄.紀錄依機器序號={};      
  });
  console.log(量測紀錄); 
  
  await database.ref("客戶管理/健身房列表").once("value").then(function (snapshot) {
    //console.log(snapshot.val());
    console.log("資料庫健身房列表讀取完成");
    健身房列表 = snapshot.val();    
  });   
  //console.log(健身房列表);

  await database.ref("量測管理/量測最後編號").once("value").then(function (snapshot) {
    //console.log(snapshot.val());
    console.log("資料庫量測要求讀取完成");
    量測最後編號 = snapshot.val();  
    if (量測最後編號==undefined) 量測最後編號=0;
  });
  //console.log(量測最後編號);
  
  await database.ref("量測管理/量測要求").once("value").then(function (snapshot) {
    //console.log(snapshot.val());
    console.log("資料庫量測要求讀取完成");
    量測要求 = snapshot.val();   
    if (量測要求==undefined) 量測要求={};
  });
  //console.log(量測要求);

  await database.ref("量測管理/量測要求歷史").once("value").then(function (snapshot) {
    //console.log(snapshot.val());
    console.log("資料庫量測要求歷史讀取完成");
    量測要求歷史 = snapshot.val();  
    if (量測要求歷史==undefined) 量測要求歷史={};
  });
  
  //if (量測要求歷史==null) 量測要求歷史={};
  //console.log(量測要求歷史);  
  
  var 使用者量測紀錄;
  await database.ref("量測紀錄").once("value").then(function (snapshot) {
    //console.log(snapshot.val());
    console.log("資料庫量測記錄/紀錄依使用者編號理讀取完成");
    使用者量測紀錄 = snapshot.val(); 
    if (使用者量測紀錄==undefined) 使用者量測紀錄={};
    console.log(使用者量測紀錄);   
  });  
  
}

async function 讀取會員資料(userId) {
  var userProfile;  
  var memberDataStr;
  // 讀取目前會員資料
  await database.ref("客戶管理/會員資料").once("value")
    .then(function (snapshot) {
      //console.log(snapshot.val());
      console.log("資料庫會員資料讀取完成");
      memberDataStr = snapshot.val();
      })
    .catch(function(error) {
      console.log("客戶管理/會員資料 failed: " + error.message)
      return [];
    });

  try {
    memberData = JSON.parse(memberDataStr);
    //console.log(memberData);
  } catch (e) {
    console.log("讀取資料庫 memberdata 失敗");
    return [];
  }

  var userFound=false;
  memberData.forEach(function(member, index, array){
   if (member[6] == userId) {
     userProfile=member;
     userFound = true;
   }
  });
  
  if (!userFound) {
    console.log("找不到 "+userId);
    return [];
  }  
  
  return userProfile;
}

async function 更新機器狀態(postData) {
  var 機器狀態 = postData.status;
  var 時間戳記 = postData.Timestamp;  
  var 機器序號 = postData.SN;
  //console.log(機器序號, 機器狀態, 時間戳記 );

  // 更新機器管理 中 機器狀態
  健身房列表.forEach(async function(健身房, index, array){
    var 健身房名稱=健身房.健身房名稱;
    var 店面名稱=健身房.店面名稱;
    //console.log(健身房名稱, 店面名稱.length );

    var 機器管理isChanged = false;
    店面名稱.forEach(function(店面名稱, index, array){
      // console.log(機器管理[健身房名稱][店面名稱]);
      if (機器序號==機器管理[健身房名稱][店面名稱].機器序號 && 時間戳記>機器管理[健身房名稱][店面名稱].狀態更新時間) {
        console.log("更新 ", 店面名稱, "機器狀態");
        if (機器管理[健身房名稱][店面名稱].機器狀態=="離線"){ //若是 "使用中"，就不更新
          機器管理isChanged = true;
          機器管理[健身房名稱][店面名稱].狀態更新時間 = 時間戳記;
          機器管理[健身房名稱][店面名稱].機器狀態    = "上線";     
        }
      }
    });

    if (機器管理isChanged) {
      //console.log(機器管理);
      await 更新資料庫機器管理();
    }
  });
  //response.send("OK");
  return;  
}

// 更新資料庫量測紀錄
async function 更新資料庫量測紀錄() {
  await database.ref('量測紀錄').set(
    量測紀錄,
    function (error) {
    if (error) {
      console.log(error); 
    } else {
      console.log("更新資料庫機器管理成功");
    }

  });
}


// 更新資料庫機器管理
async function 更新資料庫機器管理() {
  await database.ref('機器管理').set(
    機器管理,
    function (error) {
    if (error) {
      console.log(error); 
    } else {
      console.log("更新資料庫機器管理成功");
    }

  });
}

// 更新資料庫量測要求
async function 更新資料庫量測最後編號() {
  await database.ref('量測管理/量測最後編號').set(
    量測最後編號,
    function (error) {
    if (error) {
      console.log(error); 
    } else {
      console.log("更新資料庫量測最後編號");
    }

  });
}

// 更新資料庫量測要求
async function 更新資料庫量測要求() {
  await database.ref('量測管理/量測要求').set(
    量測要求,
    function (error) {
    if (error) {
      console.log(error); 
    } else {
      console.log("更新資料庫量測要求");
    }

  });
}

// 更新資料庫量測要求歷史
async function 更新資料庫量測要求歷史() {
  await database.ref('量測管理/量測要求歷史').set(
    量測要求歷史,
    function (error) {
    if (error) {
      console.log(error); 
    } else {
      console.log("更新資料庫量測要求");
    }

  });
}

// API:00
function keepAlive() {
 // 讀取 更新 machineList
 // 讀取 更新 ticketList
 initFromDatabase();    
 return("API:00 KeepAlive OK");
}

// API=01 增加新會員到資料庫
function addMember() {
  // 讀取目前會員資料
  database.ref("客戶管理").once("value").then(function (snapshot) {
    //console.log(snapshot.val());
    console.log("資料庫會員資料讀取完成");
    var result = snapshot.val();
    
    try {
      memberData = JSON.parse(result.會員資料);
      //console.log(memberData);
    } catch (e) {
      console.log("API:01 讀取資料庫失敗");
      memberData=[];
      //return 0;
    }
    
    // 檢查是否有相同的名字及 LineId
    memberAlreadyExist = false;
    memberData.forEach(function(member, index, array){
     if (member[6] == inputParam.UserId) {
       memberAlreadyExist = true;
     }
    });   
    
    if (memberAlreadyExist) {
      retuen("API:01 會員已存在");
    } else {
      // 呼叫寫入資料庫涵式
      console.log("API:01 會員不存在，寫入新會員");
      
      // addAndWriteToFirebase(成功訊息，失敗訊息)
      return(addAndWriteToFirebase("API:01 會員寫入成功", "API:01 會員寫入失敗"));
    }    
  });
}

// API=02 更新會員資料到資料庫
function updateMember() {
  // 讀取目前會員資料
  database.ref("客戶管理").once("value").then(function (snapshot) {
    //console.log(snapshot.val());
    console.log("資料庫會員資料讀取完成");
    var result = snapshot.val();
    
    try {
      memberData = JSON.parse(result.會員資料);
      //console.log(memberData);
    } catch (e) {
      console.log("API:02 讀取資料庫失敗");
      return("API:02 讀取資料庫失敗");      
      return 0;
    }
    
    // 檢查是否有相同的名字及 LineId
    var memberIdex=-1;
    memberAlreadyExist = false;
    memberData.forEach(function(member, index, array){
     if (member[6] == inputParam.UserId) {
       memberAlreadyExist = true;
       memberIdex = index;
     }
    });   
    
    if (memberAlreadyExist) {
      console.log("API:02 會員存在，更新資料");
      // 刪除 舊會員
      console.log(memberIdex);
      memberData.splice(memberIdex,1);
      console.log(memberData);
      // 新增 新會員
      return(addAndWriteToFirebase("API:02 資料更新成功", "API:02 資料更新失敗"));
    } else {
      return("API:02 會員不存在");
    }    
  });
}

function addAndWriteToFirebase(成功訊息, 失敗訊息) {
  var dataToAdd =[];
  dataToAdd = [
    inputParam.Name,
    inputParam.Gender,
    inputParam.Birth,
    inputParam.Phone,
    inputParam.ID,
    inputParam.Address,
    inputParam.UserId,    
    inputParam.PicURL, 
    inputParam.Height,
    inputParam.Weight,
    inputParam.EmergencyContact,
    inputParam.EmergencyPhone,     
  ];

  memberData.push(dataToAdd);

  //console.log(memberData);
    
  database.ref('客戶管理/會員資料').set(
    JSON.stringify(memberData),
    function (error) {
    if (error) {
        console.log(失敗訊息);
        return(失敗訊息);      
      } else {
        console.log(成功訊息);
        return(成功訊息);
      }
  });
}

// API=14 讀取 user profile"
async function getUserProfile(){
  // 讀取目前會員資料
  await database.ref("客戶管理").once("value").then(function (snapshot) {
    //console.log(snapshot.val());
    console.log("資料庫會員資料讀取完成");
    var result = snapshot.val();
    
    try {
      memberData = JSON.parse(result.會員資料);
      //console.log(memberData);
    } catch (e) {
      console.log("API:14 讀取資料庫失敗");
      return("API:14 讀取資料庫失敗");      
    }
  });
  
  var userFound=false;
  var matchedMember;
  memberData.forEach(function(member, index, array){
   if (member[6] == inputParam.UserId) {
     userFound = true;
     matchedMember = member;       
   }
  });

  if (!userFound) {
    console.log("API:14 找不到 "+inputParam.UserId);
    return("API:14 找不到 "+inputParam.UserId); 
  } else {
    console.log(matchedMember);
    return(matchedMember);
  }  
  
}

// API:20 要求量測
async function requestMeasurement() {
  if (
    inputParam.UserId      == undefined ||
    inputParam.CustomerId  == undefined ||
    inputParam.StoreId     == undefined ||
    inputParam.PhoneNumber == undefined
  )
  {
    console.log("要求量測參數錯誤:", inputParam)  ;
    return("錯誤 API:20 要求量測參數");
  }
  
  try {
    var machineId = 機器管理[inputParam.CustomerId][inputParam.StoreId].機器序號;
  } catch(e){
    console.log("機器指定錯誤:", inputParam.CustomerId, inputParam.StoreId)  ;
    return("錯誤 API:20 機器指定錯誤");     
  }
  
  if (量測要求[machineId] != undefined) {
    console.log("此機器的前一測量要求尚未完成:", machineId)  ;
    return("錯誤 API:20 此機器的前一測量要求尚未完成");    
  }
  
  量測要求[machineId] = [
    ++量測最後編號,     // 量測編號
    Date.now(),       // Timestamp
    inputParam.UserId,
    inputParam.CustomerId,
    inputParam.StoreId,
    "等待機器回應",
    inputParam.PhoneNumber,    
  ];
  
  await 更新資料庫量測要求();
  await 更新資料庫量測最後編號();
  return("成功 API:20 要求量測");  
}

// API:21 取消量測
async function cancelMeasurement(){
  if (
    inputParam.UserId     == undefined ||
    inputParam.CustomerId == undefined ||
    inputParam.StoreId    == undefined
  )
  {
    console.log("取消量測參數錯誤:", inputParam);
    return("錯誤 API:21 參數錯誤");
  }
  
  try {
    var machineId = 機器管理[inputParam.CustomerId][inputParam.StoreId].機器序號;
  } catch(e){
    console.log("機器指定錯誤:", inputParam.CustomerId, inputParam.StoreId)  ;
    return("錯誤 API:21 機器指定錯誤");   
  }
  
  if (量測要求[machineId] == undefined) {
    console.log("無此機器測量要求:", machineId);
    return("錯誤 API:21 無此機器測量要求");  
  }
  
  if (量測要求[machineId][2]==inputParam.UserId) {
    量測要求[machineId][5]="要求取消";
    await 更新資料庫量測要求();
    return("成功 API:21 要求取消");
  } else {
    return("錯誤 API:21 UserId 不符");  
  }  
  
}

// API:22 要求量測狀態
async function requestMeasurementStatus() {
  if (
    inputParam.UserId     == undefined ||
    inputParam.CustomerId == undefined ||
    inputParam.StoreId    == undefined
  )
  {
    console.log("要求量測狀態參數錯誤:", inputParam)  ;
    return("錯誤 API:22 要求量測狀態參數");
  }
  
  try {
    var machineId = 機器管理[inputParam.CustomerId][inputParam.StoreId].機器序號;
  } catch(e){
    console.log("機器指定錯誤:", inputParam.CustomerId, inputParam.StoreId)  ;
    return("錯誤 API:22 機器指定錯誤");     
  }
  
  if (量測要求[machineId] == undefined) {
    console.log("無此機器測量要求:", machineId)  ;
    return("錯誤 API:22 無此機器測量要求");    
  }
  
  if (量測要求[machineId][2]==inputParam.UserId) {
    return(量測要求[machineId][5]);
  } else {
    return("錯誤 API:22 UserId 不符");  
  }
}

// API:30 取得健身房列表
function getStoreList(){
  if (inputParam.CustomerId == undefined) {
    console.log("取得健身房列表參數錯誤:", inputParam)  ;
    return("錯誤 API:30 取得健身房列表參數錯誤");
  }
  
  var customertIsFound = false;
  var cusomerFound;
  健身房列表.forEach(function(customer, index,array){
    if (customer.健身房名稱==inputParam.CustomerId){
      console.log(customer.店面名稱);
      customertIsFound = true;      
      cusomerFound = customer.店面名稱;
    }
  }); 
  
  if (customertIsFound) {
    return(JSON.stringify(cusomerFound));
  } else {
    console.log("錯誤 API:30 找不到 "+inputParam.CustomerId);
    return("錯誤 API:30 找不到 "+inputParam.CustomerId);
  } 
}

// API:31 取得機器序號
function getMachineId(){
  if (
    inputParam.CustomerId == undefined ||
    inputParam.StoreId    == undefined
  ) 
  {
    console.log("取得機器序號參數錯誤:", inputParam)  ;
    return("錯誤 API:31 取得機器序號參數錯誤");
  }
  
  try {
    var machineId = 機器管理[inputParam.CustomerId][inputParam.StoreId].機器序號;
  } catch(e){
    console.log("機器指定錯誤:", inputParam.CustomerId, inputParam.StoreId)  ;
    return("錯誤 API:31 機器指定錯誤");   
  }
  
  console.log(inputParam.CustomerId+"/"+inputParam.StoreId+"的機器序號是:", machineId);
  return(machineId);
  
}

// API:32 依使用者編號取得量測紀錄
async function 依使用者編號取得量測紀錄(){
  if (inputParam.UserId == undefined) {
    console.log("依使用者編號取得量測紀錄:", inputParam)  ;
    return("錯誤 API:32 依使用者編號取得量測紀錄");
  }  
  var 使用者量測紀錄;
  console.log(使用者量測紀錄);  
  await database.ref("量測紀錄/紀錄依使用者編號").once("value").then(function (snapshot) {
    //console.log(snapshot.val());
    console.log("資料庫量測記錄/紀錄依使用者編號理讀取完成");
    使用者量測紀錄 = snapshot.val(); 
    if (使用者量測紀錄!=undefined) {
      console.log(使用者量測紀錄[inputParam.UserId]);
      return(JSON.stringify(使用者量測紀錄[inputParam.UserId])); 
    } else {
      console.log("使用者量測紀錄 empty");
      return("[]");       
    }
  });
  
 
}









































// 處理 API
//   API:00 ?API=00&UserId=Uxxx..xxx 
//          檢查會員 成功回應 "API:00 會員已存在" 或 "API:00 會員不存在"
//   API:01 ?API=01&UserId=12345&Name=小王&Gender=男&Birth=2019-01-01&Phone=095555555&ID=A120000000&Address=新竹市 東區 中央路
//          加入會員 成功回應 "API:01 會員已存在" 或 "API:01 會員寫入成功"
//
//   API:02 ?API=02&UserId=12345&Name=小王&Gender=男&Birth=2019-01-01&Phone=095555555&ID=A120000000&Address=新竹市 東區 中央路
//          更新資料 成功回應 "API:02 更新資料成功" 或 "API:02 更新資料失敗"
//
//   API:10 ?API=10
//          讀取 courseData, 成功回應 JSON.stringify(courseData), 失敗回應 "API:10 courseData 讀取失敗"
//   API:11 ?API=11
//          讀取 courseHistory, 成功回應 JSON.stringify(courseHistory), 失敗回應 "API:11 courseHistory 讀取失敗"
//   API:12 ?API=12
//          讀取 courseMember, JSON.stringify(courseMember), 失敗回應 "API:12 courseHistory 讀取失敗"
//
//   API:13 ?API=13&UserId=U10...CDEF
//          從 UserId 查得 PhoneNumber JSON.stringify(phoneNumber), 失敗 API:13 找不到 inputParam.UserId
//
//   API:14 ?API=14&UserId=U10...CDEF
//          讀取 user profile JSON.stringify(memberData[userId]), 失敗回應 "API:14 單一客戶資料讀取失敗"
//
//   API:20 ?API=20&UserName&CourseId&UserId&PhoneNumber
//          報名寫入 courseMember with  ["courseID", ["userName", "未繳費", "未簽到", UserId, PhoneNumber]], 成功回應 "API:20 會員報名成功" 或 "API:20 會員報名失敗"
//
//   API:21 ?API=21&UserName&CourseId&UserId&PhoneNumber
//          更新簽到欄 courseMember with  ["courseID", ["userName", "未繳費", "已簽到", UserId, PhoneNumber]], 成功回應 "API:21 會員簽到成功" 或 "API:21 會員簽到失敗"
//
//   API:30 ?API=30
//          讀取 couponData, 成功回應 JSON.stringify(couponData), 失敗回應 "API:30 couponData 讀取失敗"
//   API:31 ?API=31
//          讀取 couponHistory, 成功回應 JSON.stringify(couponHistory), 失敗回應 "API:31 couponHistory 讀取失敗"
//   API:32 ?API=32
//          讀取 couponMember, JSON.stringify(couponMember), 失敗回應 "API:32 couponHistory 讀取失敗"
//
//   API:40 ?API=40&UserName&CouponId&UserId&PhoneNumber
//          報名寫入 couponMember with  ["couponID", ["userName", "已使用", "未確認", UserId, PhoneNumber]], 成功回應 "API:40 優惠券使用成功" 或 "API:40 優惠券使用失敗"
//
//   API:50 ?API=50&UserId&ExerciseId&DataType&DateStart&DateEnd
//          取得 UserId 在 DateStart 到 DateEnd 其間 ExerciseId 的 DataType 總運動量
//          ExerciseId: 00:jogging, 01:biking, 02:Rowing, 03:Weights          
//   API:60 ?API=60&UserName&ChallengeId&UserId&PhoneNumber&Fee
//          報名寫入 challengeMember with  ["challengeId", ["userName", "日期 已參加", "未繳費"/或"免費"]], 成功回應 "API:60 挑戰賽參加成功" 或 "API:60 挑戰賽參加失敗"

// 檢查會員是否已存在
//function checkMember(){
//  memberAlreadyExist = false;
//  // 讀取目前會員資料
//  database.ref("客戶管理").once("value").then(function (snapshot) {
//    //console.log(snapshot.val());
//    console.log("資料庫會員資料讀取完成");
//    var result = snapshot.val();
//    
//    try {
//      memberData = JSON.parse(result.會員資料);
//      //console.log(memberData);
//    } catch (e) {
//      console.log("API:00 讀取資料庫失敗");
//      response.send("API:00 讀取資料庫失敗");      
//      return 0;
//    }
//    
//    //console.log(memberData);
//    memberData.forEach(function(member, index, array){
//     if (member[6] == inputParam.UserId) {
//       memberAlreadyExist = true;
//     }
//    });
//    
//    if (memberAlreadyExist) {
//      response.send("API:00 會員已存在");
//    } else {
//      response.send("API:00 會員不存在");      
//    }
//  });
//}
//function get課表圖片(){
//  // 讀取目前會員資料
//  database.ref("users/三峽運動中心團課課表").once("value").then(function (snapshot) {
//    //console.log(snapshot.val());
//    console.log("讀取課表圖片完成");
//    var result = snapshot.val();
//    
////    try {
////      var 團課圖片Url = JSON.parse(result.課程PicUrl);
////      //console.log(memberData);
////    } catch (e) {
////      console.log("API:15 讀取資料庫失敗");
////      response.send("API:15 讀取資料庫失敗");      
////      return 0;
////    }
//    
//    response.send(result.課程PicUrl); 
//    
//  });  
//}
//
////?API=20&UserName=小林&CourseId=U0002&UserId=U12345678901234567890123456789012&PhoneNumber=0932000000
//function writeCourseMember() {
//  
//  // 檢查 UserName, CourseId, UserId, PhoneNumber
//  var errMsg = "";
//  if ( inputParam.UserName == undefined ||
//       inputParam.CourseId == undefined ||
//       inputParam.UserId == undefined   ||
//       inputParam.PhoneNumber == undefined )
//  {
//    console.log("API:20 參數錯誤"); 
//    response.send("API:20 參數錯誤");
//    return 1;
//  }  
//
//  更新課程及報名人數();
//}
//
////?API=21&UserName=小白&CourseId=U0001&UserId=U001&PhoneNumber=09XXXXX222
//function signinCourseMember() {
//  
//  // 檢查 UserName, CourseId, UserId, PhoneNumber
//  var errMsg = "";
//  if ( inputParam.UserName == undefined ||
//       inputParam.CourseId == undefined ||
//       inputParam.UserId == undefined   ||
//       inputParam.PhoneNumber == undefined )
//  {
//    console.log("API:21 參數錯誤"); 
//    response.send("API:21 參數錯誤");
//    return 1;
//  }  
//
//  更新課程會員報名狀態();
//}
//
//async function 更新課程及報名人數(){
//  var courseData ;
//  var courseHistory;
//  var courseMember;
//    
//  // 讀取 課程資料，
//  databaseRef = database.ref("users/三峽運動中心/團課課程");
//  try {
//    const snapshot = await databaseRef.once('value');
//    const result = snapshot.val();
//    courseData = JSON.parse(result.現在課程);
//    courseHistory = JSON.parse(result.過去課程);     
//  }  catch (e) {
//    console.log("API:20 courseData 讀取失敗");
//    response.send("API:20 courseData 讀取失敗"); 
//    return 1;
//  }
//  
//  // 課程報名人數 加 1
//  courseData.forEach(function(course, index, array){
//    if (course[0]==inputParam.CourseId) {
//      course[7]= String(parseInt(course[7])+1);
//    }
//  });
//  //console.log(courseData);  
//  
//  // 將 課程資料 寫回資料庫
//  try {
//    const snapshot = await databaseRef.set({
//      現在課程: JSON.stringify(courseData),
//      過去課程: JSON.stringify(courseHistory),
//    }); 
//  } catch (e) {
//    console.log("API:20 courseData 寫入失敗");
//    response.send("API:20 courseData 寫入失敗"); 
//    return 1;
//  }
//  
//  // 讀取 課程會員資料
//  var databaseRef = database.ref("users/三峽運動中心/課程管理");
//  try {
//    const snapshot = await databaseRef.once('value');
//    const result = snapshot.val();
//    courseMember = JSON.parse(result.課程會員);   
//  } catch (e) {
//    console.log("API:20 courseMember 讀取失敗");
//    response.send("API:20 courseMember 讀取失敗"); 
//    return 1;
//  }  
//  
//  // 檢查是否已報名
//  var courseIndex=-1;
//  var userInCourse = false;
//  courseMember.forEach(function(course, index, array){
//    if (course[0]==inputParam.CourseId ){
//      //console.log("Course matched:", course[0]);
//      courseIndex = index;
//      if (course.length>1) {
//        for (var i=1; i< course.length; i++) {
//          //console.log(i, course[i]);
//          if (course[i][4]== inputParam.PhoneNumber){
//            //console.log(inputParam.UserName, "已經報名過 ", inputParam.CourseId);
//            //response.send("API:20 "+inputParam.UserName+" 已經報名過 "+inputParam.CourseId);   
//            userInCourse = true;
//            break;
//          }
//        }
//      }
//    }
//  });
//  // 結束: 檢查是否已報名  
//   
//  // 已經報名過
//  if (userInCourse) {
//    console.log(inputParam.UserName, "已經報名過 ", inputParam.CourseId);
//    response.send("API:20 "+inputParam.UserName+" 已經報名過 "+inputParam.CourseId); 
//    return 1;
//  };
//  
//  // CourseId 還沒被 UserPhoneNumber 報名過
//  // push to courseMember    
//
//  // 檢查是否為免費課程
//    var 免費課程 = "未繳費";
//    courseData.forEach(function(course, index, array){
//      if (course[0]==inputParam.CourseId) {
//        if ( course[5]=="免費" ||  course[5]=="0" ) {
//          免費課程 = "免費";
//          console.log("報名免費課程");
//        }
//      }        
//    });   
//  
//  courseMember[courseIndex].push([inputParam.UserName, 免費課程, "未簽到", inputParam.UserId, inputParam.PhoneNumber]);  
//  
//  databaseRef = database.ref("users/三峽運動中心/課程管理");
//  try {
//    const snapshot = await databaseRef.set({
//      課程會員: JSON.stringify(courseMember),
//    }); 
//  } catch (e) {
//    console.log("API:20 courseMember 寫入失敗");
//    response.send("API:20 courseMember 寫入失敗"); 
//    return 1;
//  }
//       
//  response.send("API:20 會員報名成功");
//}
//
//async function 更新課程會員報名狀態(){
//  var databaseRef = database.ref("users/三峽運動中心/課程管理");
//  try {
//    const snapshot = await databaseRef.once('value');
//    const result = snapshot.val();
//    courseMember = JSON.parse(result.課程會員);   
//  } catch (e) {
//    console.log("API:20 courseMember 讀取失敗");
//    response.send("API:20 courseMember 讀取失敗"); 
//    return 1;
//  }  
//  
//  // 檢查 user 是否已簽到
//  var courseIndex=-1;
//  var memberIndex=-1;
//  var userInCourse = false;
//  var userSigned = false;
//  courseMember.forEach(function(course, index, array){
//    if (course[0]==inputParam.CourseId ){
//      //console.log("Course matched:", course[0]);
//      courseIndex = index;
//      if (course.length>1) {
//        for (var i=1; i< course.length; i++) {
//          //console.log(i, course[i][2]);
//          if (course[i][4]== inputParam.PhoneNumber){  
//            userInCourse = true;
//            memberIndex  = i;
//          }
//          if (course[i][2]== "已簽到"){ 
//            userSigned = true;
//          }
//          
//          if (userInCourse == true) break;
//        }
//      }
//    }
//  });
//  // 結束: 檢查是否已報名  
//   
//  // 已經簽名過
//  if (userInCourse && userSigned) {
//    console.log(inputParam.UserName, "已經簽到過 ", inputParam.CourseId);
//    response.send("API:21 "+inputParam.UserName+" 已經簽到過 "+inputParam.CourseId); 
//    return 1;
//  };
//  
//  // CourseId 還沒被 UserPhoneNumber 簽名過
//  courseMember[courseIndex][memberIndex][2]= "已簽到";
//  console.log(courseMember[courseIndex][memberIndex]);
//  
//
//  //測試時，先不要寫入資料庫
//  databaseRef = database.ref("users/三峽運動中心/課程管理");
//  try {
//    const snapshot = await databaseRef.set({
//      課程會員: JSON.stringify(courseMember),
//    }); 
//  } catch (e) {
//    console.log("API:20 courseMember 寫入失敗");
//    response.send("API:20 courseMember 寫入失敗"); 
//    return 1;
//  }
//     
//  response.send("API:21 會員簽名成功");
//}

// 課程管理 APIs END=================================================================

// 優惠券管理 APIs ====================================================================
//function readCouponData(){
//  // 讀取目前 coupoData
//  database.ref("users/三峽運動中心/優惠券").once("value").then(function (snapshot) {
//    //console.log(snapshot.val());
//    console.log("資料庫優惠券讀取完成");
//    var result = snapshot.val();
//    //console.log(result);
//    try {
//      response.send(result.現在優惠券);     
//    } catch (e) {
//      console.log("API:30 couponData 讀取失敗");
//      response.send("API:30 coupoData 讀取失敗");      
//      return 0;
//    }
//    console.log("API:30 coupoData 讀取成功");   
//  });  
//}
//
//function readCouponHistory(){
//  // 讀取目前 coupoData
//  database.ref("users/三峽運動中心/優惠券").once("value").then(function (snapshot) {
//    //console.log(snapshot.val());
//    console.log("資料庫優惠券讀取完成");
//    var result = snapshot.val();
//    //console.log(result);
//    try {
//      response.send(result.過去優惠券);     
//    } catch (e) {
//      console.log("API:31 coupoHistory 讀取失敗");
//      response.send("API:31 coupoHistory 讀取失敗");      
//      return 0;
//    }
//    console.log("API:31 coupoHistory 讀取成功");   
//  });  
//}
//
//function readCouponMember(){
//  // 讀取目前 couponMember
//  database.ref("users/三峽運動中心/優惠券管理").once("value").then(function (snapshot) {
//    //console.log(snapshot.val());
//    console.log("資料庫優惠券管理讀取完成");
//    var result = snapshot.val();
//    //console.log(result);
//    try {      
//      response.send(result.優惠券會員);
//    } catch (e) {
//      console.log("API:32 couponMember 讀取失敗");
//      response.send("API:32 couponMember 讀取失敗");      
//      return 0;
//    }
//    console.log("API:32 couponMember 讀取成功");
//       
//  });  
//}
//
//function writeCouponMember() {
//  
//  // 檢查 UserName, CouponId, UserId, PhoneNumber
//  var errMsg = "";
//  if ( inputParam.UserName == undefined ||
//       inputParam.CouponId == undefined ||
//       inputParam.UserId == undefined   ||
//       inputParam.PhoneNumber == undefined )
//  {
//    console.log("API:40 參數錯誤"); 
//    response.send("API:40 參數錯誤");
//    return 1;
//  }   
//  // ====================================================================================
//  
//  // 讀取目前 couponMember
//  database.ref("users/三峽運動中心/優惠券管理").once("value").then(function (snapshot) {
//    //console.log(snapshot.val());
//    //console.log("資料庫優惠券管理讀取完成");
//    console.log("API:40 couponMember 讀取成功");
//    var result = snapshot.val();
//    //console.log(result);
//    try {      
//      couponMember=[];
//      couponMember = JSON.parse(result.優惠券會員);
//      //console.log(couponMember);   
//    } catch (e) {
//      console.log("API:40 couponMember 讀取失敗");
//      response.send("API:40 couponMember 讀取失敗");      
//      return 0;
//    }
//    
//    var couponIndex=-1;
//    var userInCoupon = false;
//    couponMember.forEach(function(coupon, index, array){
//      if (coupon[0]==inputParam.CouponId){
//        //console.log("coupon matched:", coupon[0]);
//        couponIndex = index;
//        if (coupon.length>1) {
//          for (var i=1; i< coupon.length; i++) {
//            //console.log(i, coupon[i]);
//            if (coupon[i][4]== inputParam.PhoneNumber){
//              //console.log(inputParam.UserName, "已經報名過 ", inputParam.CouponId);
//              //response.send("API:40 "+inputParam.UserName+" 已經報名過 "+inputParam.CouponId);   
//              userInCoupon = true;
//              break;
//            }
//          }
//        }
//      }
//    });
//
//    if (userInCoupon) {
//      console.log("API:40", inputParam.UserName, "已使用過 ", inputParam.CouponId);
//      response.send("API:40 "+inputParam.UserName+" 已使用過 "+inputParam.CouponId); 
//      return 0;
//    };
//    
//    console.log(couponIndex);
//    // CouponId 還沒被 UserName 使用過
//    // push to courseMember    
//    // 加上使用日期
//    var useDate = new Date()
//    var useDateLocal = useDate.toLocaleDateString();
//    couponMember[couponIndex].push([inputParam.UserName, useDateLocal+" 已使用", "未確認", inputParam.UserId, inputParam.PhoneNumber]);
//    //console.log(couponMember);
//
//    // Write to Database
//    database.ref('users/三峽運動中心/優惠券管理').set({
//      優惠券會員: JSON.stringify(couponMember),
//    }, function (error) {
//      if (error) {
//        console.log("API:40 會員使用優惠券失敗");
//        response.send("API:40 會員使用優惠券失敗");      
//      } else {
//        console.log("API:20 會員使用優惠券成功");
//        response.send("API:40 會員使用優惠券成功");
//      }
//
//    });
//    
//    
//    
//  });    
//}
//// 優惠券管理 APIs END=================================================================
//
//// 挑戰賽管理 APIs ====================================================================
////   API:50 ?API=50&UserId&SiteId&ExerciseId&DataType&DateStart&DateEnd
////          取得 UserId 於 SiteId 在 DateStart 到 DateEnd 其間 ExerciseId 的 DataType 總運動量
////          ExerciseId: 00:jogging, 01:biking, 02:Rowing, 03:Weights 
//
//// ?API=50&UserId=U722be0c9c9d36e011c0e556bd2047819&SiteId=LINKOU&ExerciseId=00&DataType=distance&DateStart=2019-10-01&DateEnd=2020-01-31 
//
//function getExerciseData() {
//  // 檢查 UserId, ExerciseId, DataType, DateStart, DateEnd
//  //console.log(inputParam);
//  
//  var errMsg = "";
//  if ( 
//       inputParam.UserId == undefined     ||
//       inputParam.SiteId == undefined     ||  
//       inputParam.ExerciseId == undefined ||
//       inputParam.DataType == undefined   ||  
//       inputParam.DateStart == undefined  ||
//       inputParam.DateEnd == undefined 
//    )
//  {
//    console.log("API:50 參數錯誤"); 
//    response.send("API:50 參數錯誤");
//    return 1;
//  }  
//  
//  var exerciseId;
//  switch (inputParam.ExerciseId) {
//    case "00": 
//      exerciseId = "JoggingTrainingResult";
//      break;
//    case "01":
//      exerciseId = "BikingTrainingResult";
//      break
//    default:
//      console.log("ExerciseId is unkonown");
//      
//  }
//
////  inputParam.UserId =     "U722be0c9c9d36e011c0e556bd2047819";
////  inputParam.SiteId =     "LINKOU";
////  inputParam.ExerciseId = "JoggingTrainingResult";
////  inputParam.DataType =   "distance";
////  inputParam.DateStart =  "2019-10-01";
////  inputParam.DateEnd =    "2020-01-31";
//
//  // API to uGym with SQL command
//  // SQL command API url 
//  url = "http://ugym3dbiking.azurewebsites.net/api/SQL_CmdReadCols?Code=debug123";  
//
//  
//  var requestData = {
//    "sqlCmd": "SELECT SUM("       + inputParam.DataType + 
//              " ) AS A1 FROM "    + exerciseId + 
//              " WHERE userId = '" + inputParam.UserId +
//              "' AND　site = '"   + inputParam.SiteId +     
//              "' AND　(trainingDate BETWEEN '" + inputParam.DateStart + 
//              "' AND '" + inputParam.DateEnd +
//              "') ",
//    "sqlCols": [
//              "A1",
//      ]
//  }
//
//  //console.log(requestData);
//  
//  // fire request
//  request({
//    url: url,
//    method: "POST",
//    json: requestData
//  }, function (error, res, body) {
//    if (!error && res.statusCode === 200) {
//      console.log(body);
//      response.send("API:50 取得"+JSON.stringify(body));
//    } else {
//      console.log("error: " + error)
//      console.log("res.statusCode: " + response.statusCode)
//      console.log("res.statusText: " + response.statusText)
//      response.send("API:50 失敗"+JSON.stringify(body));
//    }
//  })  
//  
//}
//
//function readChallengeData(){
//  // 讀取目前 ChallengeData
//  database.ref("users/三峽運動中心/挑戰賽").once("value").then(function (snapshot) {
//    //console.log(snapshot.val());
//    console.log("資料庫挑戰賽讀取完成");
//    var result = snapshot.val();
//    //console.log(result);
//    try {
//      response.send(result.現在挑戰賽);     
//    } catch (e) {
//      console.log("API:51 ChallengeData 讀取失敗");
//      response.send("API:51 ChallengeData 讀取失敗");      
//      return 0;
//    }
//    console.log("API:51 ChallengeData 讀取成功");   
//  });  
//}
//
//function readChallengeHistory(){
//  // 讀取目前 challengeData
//  database.ref("users/三峽運動中心/挑戰賽").once("value").then(function (snapshot) {
//    //console.log(snapshot.val());
//    console.log("資料庫挑戰賽讀取完成");
//    var result = snapshot.val();
//    //console.log(result);
//    try {
//      response.send(result.過去挑戰賽);     
//    } catch (e) {
//      console.log("API:52 challengeHistory 讀取失敗");
//      response.send("API:52 challengeHistory 讀取失敗");      
//      return 0;
//    }
//    console.log("API:52 challengeHistory 讀取成功");   
//  });  
//}
//
//function readChallengeMember(){
//  // 讀取目前 challengeMember
//  database.ref("users/三峽運動中心/挑戰賽管理").once("value").then(function (snapshot) {
//    //console.log(snapshot.val());
//    console.log("資料庫挑戰賽管理讀取完成");
//    var result = snapshot.val();
//    //console.log(result);
//    try {      
//      response.send(result.挑戰賽會員);
//    } catch (e) {
//      console.log("API:53 challengeMember 讀取失敗");
//      response.send("API:53 challengeMember 讀取失敗");      
//      return 0;
//    }
//    console.log("API:53 challengeMember 讀取成功");
//       
//  });  
//}
//
//function writeChallengeMember() {
//// ?API=60&UserName=小A&ChallengeId=T0003&UserId=U12344678901234567890123456789012&PhoneNumber=0917888999&Fee=free 
//  // 檢查 UserName, ChallengeId, UserId, PhoneNumber, Fee
//  var errMsg = "";
//  if ( inputParam.UserName    == undefined ||
//       inputParam.ChallengeId == undefined ||
//       inputParam.UserId      == undefined ||
//       inputParam.PhoneNumber == undefined ||
//       inputParam.Fee         == undefined     )
//  {
//    console.log("API:60 參數錯誤"); 
//    response.send("API:60 參數錯誤");
//    return 1;
//  }   
//  // ====================================================================================
//  
//  // 讀取目前 couponMember
//  database.ref("users/三峽運動中心/挑戰賽管理").once("value").then(function (snapshot) {
//    console.log("API:60 challengeMember 讀取成功");
//    var result = snapshot.val();
//    //console.log(result);
//    try {      
//      challengeMember=[];
//      challengeMember = JSON.parse(result.挑戰賽會員);
//      //console.log(couponMember);   
//    } catch (e) {
//      console.log("API:60 challengeMember 讀取失敗");
//      response.send("API:60 challengeMember 讀取失敗");      
//      return 0;
//    }
//    
//    var challengeIndex=-1;
//    var userInChallenge = false;
//    challengeMember.forEach(function(challenge, index, array){
//      if (challenge[0]==inputParam.ChallengeId){
//        //console.log("challenge matched:", challenge[0]);
//        challengeIndex = index;
//        if (challenge.length>1) {
//          for (var i=1; i< challenge.length; i++) {
//            //console.log(i, challenge[i]);
//            if (challenge[i][4]== inputParam.PhoneNumber){
//              //console.log(inputParam.UserName, "已經報名過 ", inputParam.ChallengeId);
//              //response.send("API:60 "+inputParam.UserName+" 已經報名過 "+inputParam.ChallengeId);   
//              userInchallenge = true;
//              break;
//            }
//          }
//        }
//      }
//    });
//
//    if (userInChallenge) {
//      console.log("API:60", inputParam.UserName, "已參加過 ", inputParam.ChallengeId);
//      response.send("API:60 "+inputParam.UserName+" 已參加過 "+inputParam.ChallengeId); 
//      return 0;
//    };
//    
//    console.log(challengeIndex);
//    // ChallengeId 還沒被 UserName 使用過
//    // push to challengeMember    
//
//    // Conver local date to format "YYYY-MM-DD"
//    var nowDate = new Date();
//    var localDateStr = nowDate.toLocaleDateString();
//    var formatDateStr = localDateStr.replace(/\//g, "-");
//    var dateArr = formatDateStr.split("-");
//    if (dateArr[1].length == 1) dateArr[1]="0"+dateArr[1]; //若是個位數，前面補 0
//    if (dateArr[2].length == 1) dateArr[2]="0"+dateArr[2]; //若是個位數，前面補 0   
//    var dateStr = dateArr[0] + "-" + dateArr[1] + "-" + dateArr[2];   
//    //console.log(dateStr);
//    // End of Conver local date to format "YYYY-MM-DD"     
//    
//    if (inputParam.Fee == "free" || inputParam.Fee == "0") {
//      challengeMember[challengeIndex].push([inputParam.UserName, dateStr+" 已參加", "免費", inputParam.UserId, inputParam.PhoneNumber]); }
//    else {
//      challengeMember[challengeIndex].push([inputParam.UserName, dateStr+" 已參加", "未繳費", inputParam.UserId, inputParam.PhoneNumber]);       
//    }
//    console.log(challengeMember);
//
//    // Write to Database
//    database.ref('users/三峽運動中心/挑戰賽管理').set({
//      挑戰賽會員: JSON.stringify(challengeMember),
//    }, function (error) {
//      if (error) {
//        console.log("API:60 會員參加挑戰賽失敗");
//        response.send("API:60 會員參加挑戰賽失敗");      
//      } else {
//        console.log("API:60 會員參加挑戰賽成功");
//        response.send("API:60 會員參加挑戰賽成功");
//      }
//
//    });
//    
//  });    
//}
//// 挑戰賽管理 APIs END=================================================================
//
//function readMachineTable(){
//  // 讀取目前 機器對應表
//  database.ref("機器對應表").once("value").then(function (snapshot) {
//    console.log("API:10 機器對應表 讀取成功");
//    var result = snapshot.val();
//    console.log(result);
//    try {      
//      response.send(result); 
//      //console.log(couponMember);   
//    } catch (e) {
//      console.log("API:10 機器對應表 讀取失敗");
//      response.send("API:10 機器對應表 讀取失敗");      
//      return 0;
//    }  
//  });
//}

// ===========================================================================================================

// 課程管理 APIs ====================================================================
//function readCourseData(){
//  // 讀取目前 courseData
//  database.ref("users/三峽運動中心/團課課程").once("value").then(function (snapshot) {
//    //console.log(snapshot.val());
//    console.log("資料庫團課課程讀取完成");
//    var result = snapshot.val();
//    //console.log(result);
//    try {
//      //var courseData = JSON.parse(result.現在課程);
//      //console.log(courseData);
//      response.send(result.現在課程);     
//    } catch (e) {
//      console.log("API:10 courseData 讀取失敗");
//      response.send("API:10 courseData 讀取失敗");      
//      return 0;
//    }
//    console.log("API:10 courseData 讀取成功");   
//  });  
//}
//
//function readCourseHistory(){
//  // 讀取目前 courseData
//  database.ref("users/三峽運動中心/團課課程").once("value").then(function (snapshot) {
//    //console.log(snapshot.val());
//    console.log("資料庫團課課程讀取完成");
//    var result = snapshot.val();
//    //console.log(result);
//    try {
//      response.send(result.過去課程);     
//    } catch (e) {
//      console.log("API:11 courseHistory 讀取失敗");
//      response.send("API:11 courseHistory 讀取失敗");      
//      return 0;
//    }
//    console.log("API:11 courseHistory 讀取成功");   
//  });  
//}
//
//function readCourseMember(){
//  // 讀取目前 courseMember
//  database.ref("users/三峽運動中心/課程管理").once("value").then(function (snapshot) {
//    //console.log(snapshot.val());
//    //console.log("資料庫課程管理讀取完成");
//    var result = snapshot.val();
//    //console.log(result);
//    try {      
//      response.send(result.課程會員);
//    } catch (e) {
//      console.log("API:12 courseMember 讀取失敗");
//      response.send("API:12 courseMember 讀取失敗");      
//      return 0;
//    }
//    console.log("API:12 courseMember 讀取成功");
//       
//  });  
//}
//
//function getUserPhoneNUmber() {
//  // 讀取目前會員資料
//  database.ref("users/三峽運動中心/客戶管理").once("value").then(function (snapshot) {
//    //console.log(snapshot.val());
//    console.log("資料庫會員資料讀取完成");
//    var result = snapshot.val();
//    
//    try {
//      memberData = JSON.parse(result.會員資料);
//      //console.log(memberData);
//    } catch (e) {
//      console.log("API:13 讀取資料庫失敗");
//      response.send("API:13 讀取資料庫失敗");      
//      return 0;
//    }
//    
//    var userFound=false;
//    memberData.forEach(function(member, index, array){
//     if (member[6] == inputParam.UserId) {
//       response.send(member[3]);
//       userFound = true;
//       return 0;
//     }
//    });
//    
//    if (!userFound) response.send("API:13 找不到 "+inputParam.UserId); 
//    
//  });  
//}