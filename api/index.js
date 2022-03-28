var http = require("http");
var url = require("url");
var fs = require("fs");
const pathModule = require('path')
var formidable = require("formidable");
const PDFParser = require("pdf2json");

var port = 8090;
var host = "localhost";

http.createServer(function (req, res) {
    var path = url.parse(req.url, true);
    if (path.pathname.endsWith("uploadFile")) {
        var form = new formidable.IncomingForm();

        form.parse(req, function (err, fields, files) {

            for (var file in files) {
                if (!files.hasOwnProperty(file)) continue;
                var oldpath = files[file].path;
                var newpath = pathModule.join(__dirname, 'upload', files[file].name);
                fs.copyFile(oldpath, newpath, function (err) {
                    if (err) throw err;
                    fs.unlink(oldpath, function (err) {
                        if (err) throw err;
                    })
                    res.write('File uploaded and moved!');
                    res.end();
                });
            }
        });
    }
    if (path.pathname.endsWith("convertFiles")) {

        var file = path.query.fileName;
        var filePath = './upload/'+file;
        if (fs.existsSync(filePath)) {                    
            let pdfParser = new PDFParser(this, 1);

            pdfParser.on("pdfParser_dataError", errData => console.error(errData.parserError) );
            pdfParser.on("pdfParser_dataReady", pdfData => {

                fs.writeFile(filePath.replace('.pdf', '.txt'), pdfParser.getRawTextContent(), ()=>{
                    let raw = (fs.readFileSync(filePath.replace('.pdf', '.txt'))).toString();
                    let data = raw.split('\r\n');
                    let json;
                    var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                    if(data[0].includes('ScoreSense')) {       
                        json = {
                            name: '',
                            scoreDate: '',
                            score: '',
                            collectionsAccounts: [],
                            allAccounts:[],
                            totalInquiries:'',
                            inquiries:[],
                        };
                        var collectionAccounts_flag = -1;
                        var allAccounts_flag = -1;
                        var compareAccount_flag = -1;
                        var subCollection = {};
                        var subCompareAccount = {};
                        var compareNum = 0;
                        var subAllAccount = {};
                        var splitTable_flag = -1;
                        var splitTablePart = '';
                        for(let i = 0; i < data.length; i++) {
                            if(data[i].includes('----------------Page')) {
                                if(data.length > i+2) data.splice(i, 3);
                            }
                        }
                        for(let i = 0; i < data.length; i++) {
                            if(data[1].includes('scoresense.com')) {
                                json._reportType = 'scoresense.com';
                            }
                            else if(data[1].includes('experian.com')) {
                                json._reportType = 'experian.com';
                            }
                            if(json._reportType === 'scoresense.com') {
                                json._clientType = data[0].slice(data[0].indexOf('| ')+2);
                            } else if(json._reportType === 'experian.com') {
                                json._clientType = data[7].slice(0, data[7].indexOf(' data'));
                            }
                            if(data[i] === 'How are my scores calculated?') {
                                if(json.score === '') {
                                    json.score = data[i-3];
                                    json.scoreDate = data[i-1];
                                }
                            }
                            if(data[i] === 'Your Personal Information') {
                                if(json.name === '') json.name = data[i+1];
                            }
                            if(data[i] === 'Collections Accounts') {    
                                collectionAccounts_flag = 1;
                            }
                            if(collectionAccounts_flag === 1) {                
                                if(['Debts that have been turned over to a third-party collection agency.', 'Closed', 'Unknown'].includes(data[i-1]) && (data[i].includes('Balance $') || data[i+1].includes('Balance $') || data[i+2].includes('Balance $'))) {                 
                                    if(Object.keys(subCollection).length > 0) {
                                        json.collectionsAccounts.push(subCollection);
                                        subCollection = {};
                                    }                    
                                    if(data[i].includes('Balance $')) {
                                        subCollection.title = '';
                                    } else if(data[i+1].includes('Balance $')) {
                                        subCollection.title = data[i];
                                    } else if(data[i+2].includes('Balance $')) {
                                        subCollection.title = data[i]+' '+data[i+1];
                                    } 
                                }
                                if(data[i].includes('Balance $') && !data[i].includes('Original Creditor: ')) {
                                    subCollection.balance = data[i].replace('Balance ', '');
                                }
                                if (data[i].includes('Balance $') && data[i].includes('Original Creditor: ')) {
                                    subCollection.balance = data[i].slice(0, data[i].indexOf('Original Creditor: ')).replace('Balance ', '');
                                    subCollection.originalCreditor = data[i].slice(data[i].indexOf('Original Creditor: ')).replace('Original Creditor: ', '');
                                }
                                if(data[i].includes('Original Creditor: ') && !data[i].includes('Balance $')) {
                                    subCollection.originalCreditor = data[i].replace('Original Creditor: ', '');
                                }
                                if(data[i].includes('COLLECTIONS') && data[i+1] === 'Act. #') {
                                    subCollection.act = data[i].replace('COLLECTIONS', '');
                                }
                                if(data[i+1] === 'Opened' && data[i-1] == 'Act. #') {
                                    subCollection.opened = data[i];
                                }
                                if(data[i+1] === 'Condition' && data[i-1] === 'Reported') {
                                    subCollection.reported = data[i-2];
                                    subCollection.condition = data[i];
                                }
                                if(data[i-1] === 'Condition' && data[i-2] === 'Balance' && data[i-3] === 'Opened' && data[i-4] === 'Original Creditor' && data[i-5] === 'Reported') {
                                    compareAccount_flag = 1;
                                }
                                if(data[i-1] === 'Condition' && data[i-2] === 'Balance' && data[i-3] === 'Opened' && data[i-4] === 'Original Creditor' && data[i-8].includes('Reported')) {
                                    compareAccount_flag = 1;
                                    splitTable_flag = 1;
                                    splitTablePart = data[i-8];
                                }
                                if(compareAccount_flag === 1) {
                                    if(compareNum === 0) subCollection.compareThisAccountAcrossAllBureaus = [];
                                    compareNum++;
                                    var division = 5;
                                    if(splitTable_flag === 1) {
                                        division = 4;
                                        var reportedComplex = splitTablePart.replace('Reported','');
                                        if(compareNum % division === 0) {
                                            subCompareAccount.Reported = reportedComplex.slice(0+10*(compareNum/division-1), 10*compareNum/division)
                                        }
                                        if(compareNum % division === 1) subCompareAccount.OriginalCreditor = data[i];
                                        if(compareNum % division === 2) subCompareAccount.Opened = data[i];
                                        if(compareNum % division === 3) subCompareAccount.Balance = data[i];
                                    } else {
                                        if(compareNum % division === 1) subCompareAccount.Reported = data[i];
                                        if(compareNum % division === 2) subCompareAccount.OriginalCreditor = data[i];
                                        if(compareNum % division === 3) subCompareAccount.Opened = data[i];
                                        if(compareNum % division === 4) subCompareAccount.Balance = data[i];
                                    }                   
                                    if(compareNum % division === 0) {
                                        subCompareAccount.Condition = data[i];
                                        subCollection.compareThisAccountAcrossAllBureaus.push(subCompareAccount);
                                        subCompareAccount = {};
                                        if(data[i+1].includes('Balance $') || data[i+2].includes('Balance $') || data[i+3].includes('Balance $')) {
                                            compareAccount_flag = -1;
                                            compareNum = 0;
                                            var collectionCompareList = subCollection.compareThisAccountAcrossAllBureaus;
                                            if(collectionCompareList.length === 3) {
                                                switch (json._clientType) {
                                                    case 'Transunion':
                                                        subCollection.compareThisAccountAcrossAllBureaus = collectionCompareList[0]
                                                        break;
                                                    case 'Equifax':
                                                        subCollection.compareThisAccountAcrossAllBureaus = collectionCompareList[1]
                                                        break;
                                                    case 'Experian':
                                                        subCollection.compareThisAccountAcrossAllBureaus = collectionCompareList[2]
                                                        break;
                                                    default:
                                                        break;
                                                }
                                            } else if(collectionCompareList.length === 2) {
                                                switch (json._clientType) {
                                                    case 'Transunion':
                                                        subCollection.compareThisAccountAcrossAllBureaus = collectionCompareList[0]
                                                        break;
                                                    default:
                                                        subCollection.compareThisAccountAcrossAllBureaus = collectionCompareList[1]
                                                        break;
                                                }
                                            } else {
                                                subCollection.compareThisAccountAcrossAllBureaus = collectionCompareList[0]
                                            }
                                        }
                                    }
                                }               
                                if(data[i] === 'Your Accounts') {
                                    json.collectionsAccounts.push(subCollection);
                                    collectionAccounts_flag = -1
                                    allAccounts_flag = 1;
                                    compareAccount_flag = -1;
                                }            
                            }
                            if(allAccounts_flag === 1) {
                                if(data[i].includes('Act.# ')) {
                                    subAllAccount.name = data[i-1];
                                    subAllAccount.act = data[i].replace('Act.# ', '');
                                    subAllAccount.state = data[i+1].slice(0, -10);
                                }
                                if(data[i] === 'Credit Limit') {
                                    subAllAccount.creditLimit = data[i-1];
                                }
                                if(data[i] === 'High Balance') {
                                    subAllAccount.highBalance = data[i-1];
                                }
                                if(data[i] === 'Balance') {
                                    subAllAccount.balance = data[i-1];
                                }
                                if(data[i] === 'Account Type') {
                                    if(data[i-1].includes('Account')) {
                                        subAllAccount.accountType = data[i-1].slice(data[i-1].indexOf('Account')+7);
                                        subAllAccount.type = data[i-1].slice(0, data[i-1].indexOf('Account') + 7);
                                    }
                                }
                                if(data[i] === 'Condition') {
                                    subAllAccount.condition = data[i-1];
                                }
                                if(data[i] === 'Date Reported') {
                                    subAllAccount.dateReported = data[i-1];
                                }
                                if(data[i] === 'Payment') {
                                    subAllAccount.payment = data[i-1];
                                }
                                if((data[i-1] === 'Balance' || data[i-1].includes('Creditor Contact:')) && data[i].includes('Late Payment')) {
                                    subAllAccount.paymentHistory = {};
                                }
                                if(data[i].includes('Late Payment')) {
                                    var subInfo = {};
                                    if(data[i].includes('Late Payments')) {
                                        subInfo.latePayments = data[i].slice(4).replace('Late Payments','');
                                    } else { 
                                        subInfo.latePayments = data[i].slice(4).replace('Late Payment','');
                                    }
                                    subInfo.paymentPerMonths = {};
                                    var paymentPerMonths = [];
                                    var kk = 0;
                                    var paymentString = data[i+1];
                                    if(data[i+1] === 'All Accounts') {
                                        paymentString = data[i+3];
                                    }
                                    for (let j = 0; j < paymentString.length; j++) {
                                        if(paymentString[j] === '') {
                                            paymentPerMonths.push('0');
                                        } else {
                                            kk++;
                                            if(kk === 2) {
                                                paymentPerMonths.push(String(paymentString[j-1])+String(paymentString[j]));
                                                kk = 0;
                                            }
                                        }                  
                                    }
                                    for (let k = 0; k < months.length; k++) {
                                        if(data[i-1] === 'Balance') {
                                            if(k < paymentPerMonths.length) {
                                                subInfo.paymentPerMonths[months[k]] = paymentPerMonths[k]
                                            } else {
                                                subInfo.paymentPerMonths[months[k]] = '-';
                                            }
                                        } else if(!data[i+2].includes('Late Payment')) {
                                            if(k >= 12 - paymentPerMonths.length) {
                                                subInfo.paymentPerMonths[months[k]] = paymentPerMonths[k-12+paymentPerMonths.length];
                                            } else {
                                                subInfo.paymentPerMonths[months[k]] = '-';
                                            }
                                        } else {
                                            subInfo.paymentPerMonths[months[k]] = paymentPerMonths[k]
                                        }
                                    }
                                    reverseObj = (obj) =>{
                                        return Object.keys(obj).reverse().reduce((a,key,i)=>{
                                            a[key] = obj[key];
                                            return a;
                                        }, {})
                                    };
                                    subInfo.paymentPerMonths = reverseObj(subInfo.paymentPerMonths)
                                    subAllAccount.paymentHistory[data[i].slice(0, 4)] = subInfo;
                                }
                                if(data[i].includes('Late Payment') && data[i+3] === 'Account Type') {
                                    json.allAccounts.push(subAllAccount);
                                    subAllAccount = {};
                                }
                            }
                            if(data[i].includes('Total Inquiries: ')) {
                                json.totalInquiries = data[i].replace('Total Inquiries: ', '');
                                allAccounts_flag = -1;
                            } 
                            if(data[i].includes('Inquiry: ')) {
                                var subInquiries = {};
                                if(data[i].includes('Inquiry: ') && data[i].includes('Date of Inquiry: ')) {
                                    subInquiries.inquiry = data[i].slice(0, data[i].indexOf('Date of Inquiry: ')).replace('Inquiry: ', '');
                                    subInquiries.dateOfInquiry = data[i].slice(data[i].indexOf('Date of Inquiry: ')).replace('Date of Inquiry: ', '');
                                    subInquiries.contact = data[i+1].replace('Contact: ', '');
                                    json.inquiries.push(subInquiries);
                                }
                            }
                        }        
                    } else if(data[0].includes('Experian')) { 
                        json = {
                            name: '',
                            dateGenerated: '',
                            picoScore: '',
                            openAccounts: [],
                            collectionAccounts: [],
                            publicRecords: '',
                            inquiries:[],
                        };
                        
                        var flag = -1;
                        var openAccountFlag = -1;
                        var collectionAccountFlag = -1;
                        var subAccountInfoFlag = -1;
                        var subAccountPaymentHistoryFlag = -1;
                        var publicRecordsFlag = -1;
                        var subPublicRecords;
                        var subInquiries = [];
                        var subAccount = {};
                        var subAccountInfo = {};
                        var paymentHistoryNumYear;
                        for(let i = 0; i < data.length; i++) {
                            if(data[i].includes('----------------Page')) {
                                if(data.length > i+3) data.splice(i, 4);
                            }
                        }
                        for(let i = 0; i < data.length; i++) {
                            if(data[1].includes('scoresense.com')) {
                                json._reportType = 'scoresense.com';
                            }
                            else if(data[1].includes('experian.com')) {
                                json._reportType = 'experian.com';
                            }
                            if(json._reportType === 'scoresense.com') {
                                json._clientType = data[0].slice(data[0].indexOf('| ')+2);
                            } else if(json._reportType === 'experian.com') {
                                json._clientType = data[7].slice(0, data[7].indexOf(' data'));
                            }
                            if(data[i].includes('Prepared For')) {
                                if(json.name === '') json.name = data[i].replace('Prepared For', '');
                            }
                            if(data[i].includes('Date generated:')) {
                                if(json.dateGenerated === '') json.dateGenerated = data[i].replace('Date generated: ', '');
                            }
                            if(data[i].includes('FICO Score 8')) {
                                if(json.picoScore === '') json.picoScore = data[i].replace('FICO Score 8', '');
                            }
                            if(data[i-1] === 'Open accounts') {
                                openAccountFlag = 1;
                            }
                            if(openAccountFlag === 1) {
                                if(data[i+4].includes('Account info')) {
                                    subAccount.name = data[i];                
                                    subAccount.state = data[i+1];
                                }   
                                if(data[i-1] === 'Account info') {
                                    subAccountInfoFlag = 1;
                                }           
                                if(subAccountInfoFlag === 1) {
                                    if(data[i].includes('Account name')) {
                                        subAccountInfo.AccountName = data[i].replace('Account name','');
                                    }
                                    if(data[i].includes('Account number')) {
                                        subAccountInfo.AccountNumber = data[i].replace('Account number','');
                                    }
                                    if(data[i].includes('Original creditor')) {
                                        subAccountInfo.OriginalCreditor = data[i].replace('Original creditor','');
                                    }
                                    if(data[i].includes('Company sold')) {
                                        subAccountInfo.CompanySold = data[i].replace('Company sold','');
                                    }
                                    if(data[i].includes('Date opened')) {
                                        subAccountInfo.DateOpened = data[i].replace('Date opened','');
                                    }
                                    if(data[i].includes('Account status')) {
                                        subAccountInfo.AccountStatus = data[i].replace('Account status','');
                                    }
                                    if(data[i].includes('Status updated')) {
                                        subAccountInfo.StatusUpdated = data[i].replace('Status updated','');
                                    }
                                    if(data[i].includes('Account type')) {
                                        subAccountInfo.AccountType = data[i].replace('Account type','');
                                    }
                                    if(data[i].includes('Payment status')) {
                                        subAccountInfo.PaymentStatus = data[i].replace('Payment status','');
                                    }
                                    if(data[i].includes('Balance')) {
                                        subAccountInfo.Balance = data[i].replace('Balance','');
                                    }
                                    if(data[i].includes('Balance updated')) {
                                        subAccountInfo.BalanceUpdated = data[i].replace('Balance updated','');
                                    }
                                    if(data[i].includes('Paid off')) {
                                        subAccountInfo.PaidOff = data[i].replace('Paid off','');
                                    }
                                    if(data[i].includes('Monthly payment')) {
                                        subAccountInfo.MonthlyPayment = data[i].replace('Monthly payment','');
                                    }
                                    if(data[i].includes('Past due amount')) {
                                        subAccountInfo.PastDueAmount = data[i].replace('Past due amount','');
                                    }
                                    if(data[i].includes('Terms')) {
                                        subAccountInfo.Terms = data[i].replace('Terms','');
                                    }
                                    if(data[i].includes('Responsibility')) {
                                        subAccountInfo.Responsibility = data[i].replace('Responsibility','');
                                    }
                                    if(data[i].includes('Your statement')) {
                                        subAccountInfo.YourStatement = data[i].replace('Your statement','');
                                    }
                                    if(data[i].includes('Highest balance')) {
                                        subAccountInfo.HighestBalance = data[i].replace('Highest balance','');
                                    }
                                    if(data[i].includes('Credit limit')) {
                                        subAccountInfo.CreditLimit = data[i].replace('Credit limit','');
                                    }
                                    if(data[i].includes('Usage')) {
                                        subAccountInfo.Usage = data[i].replace('Usage','');
                                    }
                                    if(data[i] === 'Payment history') {
                                        subAccount.AccountInfo = subAccountInfo;
                                        subAccountInfo = {};
                                        subAccountInfoFlag = -1;
                                        subAccountPaymentHistoryFlag =1;
                                        paymentHistoryNumYear = 0;
                                    }
                                }
                                if(subAccountPaymentHistoryFlag ===  1) {
                                    if(data[i-1] === 'Payment history' && data[i+1] === 'Contact info') {
                                        subAccount.paymentHistory = data[i];
                                    } else {
                                        if(!subAccount.hasOwnProperty('paymentHistory')) subAccount.paymentHistory = {};
                                        if(data[i].length === 4 && Number(data[i]) <= new Date().getFullYear()) {
                                            subAccount.paymentHistory[data[i]] = {};
                                            paymentHistoryNumYear++;
                                            for (let j = 0; j < months.length; j++) {
                                                subAccount.paymentHistory[data[i]][months[j]] = 'o';                               
                                            }
                                        }
                                        if(months.includes(data[i])) {
                                            var index = months.indexOf(data[i]);
                                            var monthInfo = [];
                                            for (let j = 1; j <= paymentHistoryNumYear; j++) {
                                                if(data[i+j].includes(months[index+1]) || data[i+j].includes('On time')) break;
                                                monthInfo.push(data[i+j]);
                                            }
                                            if(Object.keys(subAccount.paymentHistory).length === monthInfo.length) {
                                                for (let k = Object.keys(subAccount.paymentHistory).length-1; k >= 0; k--) {
                                                    subAccount.paymentHistory[Object.keys(subAccount.paymentHistory)[paymentHistoryNumYear-1-k]][data[i]] = monthInfo[k]; 
                                                }
                                            } else if(Object.keys(subAccount.paymentHistory)[0] > subAccount.AccountInfo.DateOpened.slice(-4)) {
                                                for (let k = 0; k < Object.keys(subAccount.paymentHistory).length; k++) {
                                                    if(Object.keys(subAccount.paymentHistory)[paymentHistoryNumYear-1] === subAccount.AccountInfo.StatusUpdated.slice(-4) && index >= months.indexOf(subAccount.AccountInfo.StatusUpdated.slice(0,3))) {
                                                        if(typeof monthInfo[k] !== 'undefined') subAccount.paymentHistory[Object.keys(subAccount.paymentHistory)[paymentHistoryNumYear-1-k]][data[i]] = monthInfo[k]; 
                                                    } else if(monthInfo.length-1-k >= 0) {
                                                        subAccount.paymentHistory[Object.keys(subAccount.paymentHistory)[k]][data[i]] = monthInfo[monthInfo.length-k-1]; 
                                                    } else {
                                                        break;
                                                    }
                                                }       
                                            } else {
                                                for (let k = Object.keys(subAccount.paymentHistory).length-1; k >= 0; k--) {
                                                    if(Object.keys(subAccount.paymentHistory)[0] === subAccount.AccountInfo.DateOpened.slice(-4) && index < months.indexOf(subAccount.AccountInfo.DateOpened.slice(0,3))) {                                    
                                                        subAccount.paymentHistory[Object.keys(subAccount.paymentHistory)[0]][data[i]] = monthInfo[monthInfo.length-1]; 
                                                    }
                                                    if(Object.keys(subAccount.paymentHistory)[paymentHistoryNumYear-1] === subAccount.AccountInfo.StatusUpdated.slice(-4) && index >= months.indexOf(subAccount.AccountInfo.StatusUpdated.slice(0,3))) {
                                                        subAccount.paymentHistory[Object.keys(subAccount.paymentHistory)[paymentHistoryNumYear-1]][data[i]] = monthInfo[0];
                                                    }
                                                    if(Object.keys(subAccount.paymentHistory)[k] < subAccount.AccountInfo.DateOpened.slice(-4)) {
                                                        subAccount.paymentHistory[Object.keys(subAccount.paymentHistory)[k]][data[i]] = '-';
                                                    }
                                                    if(monthInfo.length-1-k >= 0 && Object.keys(subAccount.paymentHistory)[paymentHistoryNumYear-1] < subAccount.AccountInfo.StatusUpdated.slice(-4)) {
                                                        subAccount.paymentHistory[Object.keys(subAccount.paymentHistory)[k]][data[i]] = monthInfo[monthInfo.length-k-1]; 
                                                    }
                                                }
                                            }
                                        }
                                    }
                                    if(data[i-1] === 'Contact info') {
                                        subAccountPaymentHistoryFlag = -1; 
                                        subAccount.contactInfo = [];  
                                    }
                                }
                                if(subAccount.hasOwnProperty('contactInfo')) {
                                    subAccount.contactInfo.push(data[i]);
                                }
                                if(data[i+1] === 'Comments') {
                                    subAccount.comments = data[i+2];
                                    reverseObj = (obj) =>{
                                        return Object.keys(obj).reverse().reduce((a,key,i)=>{
                                            a[key] = obj[key];
                                            return a;
                                        }, {})
                                    };
                                    for (const key in subAccount.paymentHistory) {
                                        if (Object.hasOwnProperty.call(subAccount.paymentHistory, key)) {
                                            subAccount.paymentHistory[key] = reverseObj(subAccount.paymentHistory[key])                          
                                        }
                                    }
                                    json.openAccounts.push(subAccount);
                                    subAccount = {};
                                }
                                if(data[i] === 'Public records' || data[i] === 'Collection accounts') {
                                    openAccountFlag = -1;
                                }
                            }
                            if(data[i-1] === 'Collection accounts') {
                                collectionAccountFlag = 1;
                                subAccount = {};
                            }
                            if(collectionAccountFlag === 1) {
                                if(data[i+4].includes('Account info')) {
                                    subAccount.name = data[i];                
                                    subAccount.state = data[i+1];
                                }   
                                if(data[i-1] === 'Account info') {
                                    subAccountInfoFlag = 1;
                                    subAccountInfo = {};
                                }           
                                if(subAccountInfoFlag === 1) {
                                    if(data[i].includes('Account name')) {
                                        subAccountInfo.AccountName = data[i].replace('Account name','');
                                    }
                                    if(data[i].includes('Account number')) {
                                        subAccountInfo.AccountNumber = data[i].replace('Account number','');
                                    }
                                    if(data[i].includes('Original creditor')) {
                                        subAccountInfo.OriginalCreditor = data[i].replace('Original creditor','');
                                    }
                                    if(data[i].includes('Company sold')) {
                                        subAccountInfo.CompanySold = data[i].replace('Company sold','');
                                    }
                                    if(data[i].includes('Date opened')) {
                                        subAccountInfo.DateOpened = data[i].replace('Date opened','');
                                    }
                                    if(data[i].includes('Account status')) {
                                        subAccountInfo.AccountStatus = data[i].replace('Account status','');
                                    }
                                    if(data[i].includes('Status updated')) {
                                        subAccountInfo.StatusUpdated = data[i].replace('Status updatedr','');
                                    }
                                    if(data[i].includes('Account type')) {
                                        subAccountInfo.AccountType = data[i].replace('Account type','');
                                    }
                                    if(data[i].includes('Payment status')) {
                                        subAccountInfo.PaymentStatus = data[i].replace('Payment status','');
                                    }
                                    if(data[i].includes('Balance')) {
                                        subAccountInfo.Balance = data[i].replace('Balance','');
                                    }
                                    if(data[i].includes('Balance updated')) {
                                        subAccountInfo.BalanceUpdated = data[i].replace('Balance updated','');
                                    }
                                    if(data[i].includes('Paid off')) {
                                        subAccountInfo.PaidOff = data[i].replace('Paid off','');
                                    }
                                    if(data[i].includes('Monthly payment')) {
                                        subAccountInfo.MonthlyPayment = data[i].replace('Monthly payment','');
                                    }
                                    if(data[i].includes('Past due amount')) {
                                        subAccountInfo.PastDueAmount = data[i].replace('Past due amount','');
                                    }
                                    if(data[i].includes('Terms')) {
                                        subAccountInfo.Terms = data[i].replace('Terms','');
                                    }
                                    if(data[i].includes('Responsibility')) {
                                        subAccountInfo.Responsibility = data[i].replace('Responsibility','');
                                    }
                                    if(data[i].includes('Your statement')) {
                                        subAccountInfo.YourStatement = data[i].replace('Your statement','');
                                    }
                                    if(data[i].includes('Highest balance')) {
                                        subAccountInfo.HighestBalance = data[i].replace('Highest balance','');
                                    }
                                    if(data[i].includes('Credit limit')) {
                                        subAccountInfo.CreditLimit = data[i].replace('Credit limit','');
                                    }
                                    if(data[i].includes('Usage')) {
                                        subAccountInfo.Usage = data[i].replace('Usage','');
                                    }
                                    if(data[i-1] === 'Contact info') {
                                        subAccount.AccountInfo = subAccountInfo;
                                        subAccountInfo = {};
                                        subAccountInfoFlag = -1;
                                        subAccount.contactInfo = [];  
                                    }
                                }
                                if(subAccount.hasOwnProperty('contactInfo')) {
                                    subAccount.contactInfo.push(data[i]);
                                }
                                if(data[i+1] === 'Comments') {
                                    subAccount.comments = data[i+2];                    
                                    json.collectionAccounts.push(subAccount);
                                    subAccount = {};
                                }
                                if(data[i] === 'Public records') {
                                    collectionAccountFlag = -1;
                                }
                            }
                            if(data[i-1] === 'Public records') {
                                if(json.publicRecords === '') {
                                    if(data[i+1] === 'Inquiries') {
                                        json.publicRecords = data[i].replace(' reported',''); 
                                    } else {
                                        json.publicRecords = [];
                                        publicRecordsFlag = 1;
                                    }
                                }
                            } 
                            if(publicRecordsFlag === 1) {
                                if(data[i].includes('Bankruptcy: ') || data[i].includes('bankruptcy ')) {
                                    subPublicRecords = {};
                                    if (data[i].includes('Bankruptcy: ')) {
                                        subPublicRecords['Bankruptcy'] = data[i].replace('Bankruptcy: ', '');
                                    } else if(data[i].includes('bankruptcy ')) {
                                        subPublicRecords['Bankruptcy'] = data[i].slice(data[i].indexOf('bankruptcy')).replace('bankruptcy ', '');
                                    }
                                    
                                }
                                if(data[i].includes('Filed on ')) {
                                    subPublicRecords['Filed_on'] = data[i].replace('Filed on ', '');
                                }
                                if(data[i] == 'Reference number:') {
                                    subPublicRecords['Reference_number'] = data[i+1];
                                }
                                if(data[i] == 'Court:') {
                                    subPublicRecords['Court'] = data[i+1];
                                    json.publicRecords.push(subPublicRecords);
                                }
                                if(data[i+1] === 'Inquiries') {
                                    publicRecordsFlag = -1; 
                                }
                            }
                            if(data[i-1] === 'Inquiries') {
                                flag = 1;
                            }
                            if(flag === 1) {
                                if(data[i].includes('This inquiry is scheduled to continue on record')) {
                                    subInquiries.push(data[i]);
                                    json.inquiries.push(subInquiries);
                                    subInquiries = [];
                                } else {
                                    subInquiries.push(data[i]);
                                }           
                            }
                        }
                    }
                
                    fs.writeFile(filePath.replace('.pdf', '.json'), JSON.stringify(json), err => {    
                        // Checking for errors
                        if (err) throw err; 
                        console.log("Done writing"); // Success
                        // res.sendFile(filePath.replace('.pdf', '.json'));
                        var stat = fs.statSync(filePath.replace('.pdf', '.json'));

                        res.writeHead(200, {
                            'Content-Type': 'application/json',
                            'Content-Length': stat.size
                        });

                        var readStream = fs.createReadStream(filePath.replace('.pdf', '.json'));
                        // We replaced all the event handlers with a simple call to readStream.pipe()
                        readStream.pipe(res);
                    })         
                })
            });
            pdfParser.loadPDF(filePath); 
        }

    }
    if (path.pathname.endsWith("downloadFile")) {
        var file = path.query.fileName;
        var filePath = './upload/'+file;
        if (fs.existsSync(filePath)) {
            var stat = fs.statSync(filePath);

            res.writeHead(200, {
                'Content-Type': 'application/pdf',
                'Content-Length': stat.size
            });

            var readStream = fs.createReadStream(filePath);
            // We replaced all the event handlers with a simple call to readStream.pipe()
            readStream.pipe(res);
        }
    }
    if (path.pathname.endsWith("removeFile")) {
        var file = path.query.fileName;
        var filePath = './upload/'+file;
        if (fs.existsSync(filePath)) {
            fs.unlink(filePath, function (err) {
                if (err) throw err;
                if(fs.existsSync(filePath.replace('.pdf', '.txt'))) {
                    fs.unlink(filePath.replace('.pdf', '.txt'), function (err) {
                        if (err) throw err;
                    })
                }
                if(fs.existsSync(filePath.replace('.pdf', '.json'))) {
                    fs.unlink(filePath.replace('.pdf', '.json'), function (err) {
                        if (err) throw err;
                    })
                }
                // if no error, file has been deleted successfully
                res.write('File deleted');
                console.log('File deleted!');
            });
        }
    }
    if (path.pathname.endsWith("showFile")) {
        var file = path.query.fileName;
        var filePath = './upload/'+file;
        if (fs.existsSync(filePath)) {
            var stat = fs.statSync(filePath);

            res.writeHead(200, {
                'Content-Type': 'application/pdf',
                'Content-Length': stat.size
            });

            var readStream = fs.createReadStream(filePath);
            // We replaced all the event handlers with a simple call to readStream.pipe()
            readStream.pipe(res);
        }
    }
    if (path.pathname.endsWith("init")) {
        fs.readdir('./upload', (err, files) => {
            if (err) throw err;
            for (const file of files) {
                fs.unlink(pathModule.join('./upload', file), err => {
                    if (err) throw err;
                });
            }
            console.log('upload inited');
            res.write('upload inited');
            res.end();
        });
    }
    if (path.pathname.endsWith("")) {
        fs.readFile("./build/index.html", (err, contents) => {
            if (err) {
                res.writeHead(500);
                res.end(err);
                return;
            } else {
                res.setHeader("Content-Type", "text/html");
                res.writeHead(200);
                res.end(contents);
            }
        });            
    }
}).listen(port, host);
console.log("server started.");

