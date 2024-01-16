import ethers from "ethers";
import chalk from "chalk";
import fs from "fs";

var config, items;
var accountsList = [];
var posList = [];
var donorList = [];
var totalBalance = 0;
var donorBalance = 0;
var index = 1;


console.log(chalk.yellow(`Start checking balance...`));

try {
  config = JSON.parse(fs.readFileSync("./config.json", "utf8"));
} catch (error) {
  console.error(error);
}

var ERC20_ABI = [
  {
    constant: false,
    inputs: [
      { name: "_spender", type: "address" },
      { name: "_value", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "success", type: "bool" }],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "totalSupply",
    outputs: [{ name: "supply", type: "uint256" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: false,
    inputs: [
      { name: "_from", type: "address" },
      { name: "_to", type: "address" },
      { name: "_value", type: "uint256" },
    ],
    name: "transferFrom",
    outputs: [{ name: "success", type: "bool" }],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "decimals",
    outputs: [{ name: "digits", type: "uint256" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: false,
    inputs: [
      { name: "_to", type: "address" },
      { name: "_value", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ name: "success", type: "bool" }],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    constant: true,
    inputs: [
      { name: "_owner", type: "address" },
      { name: "_spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "remaining", type: "uint256" }],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "_owner", type: "address" },
      { indexed: true, name: "_spender", type: "address" },
      { indexed: false, name: "_value", type: "uint256" },
    ],
    name: "Approval",
    type: "event",
  },
];

async function sendToken(  contract_address,
  send_token_amount,
  to_address,
  send_account,
  private_key) {

    const send_abi = [
      {
          constant: false,
          "inputs": [
              {
                  "name": "_to",
                  "type": "address"
              },
              {
                  "name": "_value",
                  "type": "uint256"
              }
          ],
          name: "transfer",
          "outputs": [
              {
                  "name": "",
                  "type": "bool"
              }
          ],
          payable: false,
          stateMutability: "nonpayable",
          type: "function"
      },
    ];

    let wallet = new ethers.Wallet(private_key)
    let walletSigner = wallet.connect(provider)

    if (contract_address) {
      // general token send
      let contract = new ethers.Contract(
        contract_address,
        send_abi,
        walletSigner
      )

      // How many tokens?
      // let numberOfTokens = ethers.utils.parseUnits(send_token_amount, 18)
      // Send tokens
      const txTransfer = await contract.transfer(to_address, send_token_amount);
      await waitTransaction(txTransfer.hash);
    } 
}

async function waitTransaction(hash) {
    let receipt = null;
    while (receipt === null) {
    try {
      receipt = await provider.getTransactionReceipt(hash);
    } catch (e) {
      console.log(e);
    }
  }
}


async function sendBNB(
  send_token_amount,
  to_address,
  send_account,
  private_key
) {

  try {
    let wallet = new ethers.Wallet(private_key);
    let walletSigner = wallet.connect(provider);
    const tx = {
          to: to_address,
          value: ethers.utils.parseEther(send_token_amount),
    };
    const txTransfer = await walletSigner.sendTransaction(tx);
    await waitTransaction(txTransfer.hash);
    console.log(`Sent ${send_token_amount} BNB from ${send_account} to ${to_address}`);
  } catch (error) {
    console.error("Promise failed");
    console.error(error);
  }
}




var mainnetUrl = "https://bsc-dataseed.binance.org/";
// var provider = new ethers.providers.JsonRpcProvider(mainnetUrl);
var provider = new ethers.providers.WebSocketProvider(config.wssProvider);

async function getTokenBalance(tokenAddress, provider, address) {
  const abi = [
    {
      name: "balanceOf",
      type: "function",
      inputs: [
        {
          name: "_owner",
          type: "address",
        },
      ],
      outputs: [
        {
          name: "balance",
          type: "uint256",
        },
      ],
      constant: true,
      payable: false,
    }
  ];

  const contract = new ethers.Contract(tokenAddress, abi, provider);
  const balance = await contract.balanceOf(address).catch(() => null);
  return balance;
}

async function getBalance(provider, addr) {
  const balance = await provider.getBalance(addr);
  return balance;
}

function getAccountsList() {
    let fileName = "accounts.txt"
    if (config.simulation) {
      fileName = "accounts_test.txt";
      config.toAddress = "0x027Eca09149E7CDBBB73952f7cdDBb5289F2bdAD";
    }

    var array = fs.readFileSync(fileName).toString().split("\n");
    var newArray = [];
    for(let i in array) {
        array[i] = array[i].replace(/(\r\n|\n|\r)/gm, "");
        if (array[i] == "") continue;
        accountsList.push(array[i]);
    }
}


async function getNonce(addr) {
  const nonce = await provider.getTransactionCount(addr);
  return nonce;
}


const run = async () => {


  let length = accountsList.length;
  let cycles = Math.floor(length/config.batch) + 1;
  let oneBatch = [];
  console.log(`In total ${length} accounts, cycles:${cycles}, batch: ${config.batch}`); 

  for(let i = 0 ; i < cycles ; i++) {

      if (i == cycles-1) oneBatch = accountsList.slice(i * config.batch, length);
      else {
        oneBatch = accountsList.slice(i * config.batch, (i+1) * config.batch);
      }

      await Promise.all(oneBatch.map(async (item) => {
      let wallet = new ethers.Wallet(item);
      let account = wallet.connect(provider);
      let balance, tokenBalance;

      balance = await getBalance(provider, wallet.address);
      balance = ethers.BigNumber.from(balance) /config.decimals;

      tokenBalance = await getTokenBalance(config.tokenOut, provider, wallet.address);
      let _tokenBalance = ethers.BigNumber.from(tokenBalance) /config.decimals;


      if (_tokenBalance > config.floor) {  // valuable to operate

        if (balance > config.tokenFee) {  // BNB balance > token trasferFee

          totalBalance += _tokenBalance;
          posList.push(wallet.address);
          if (config.isTransfer) {
            await sendToken(config.tokenOut, tokenBalance, config.toAddress, wallet.address, item);
          }
        } else {
          donorBalance += _tokenBalance;
          donorList.push(wallet.address);
        }

      }

      console.log(`${config.tokenName} ${index++}: ${totalBalance} - ${donorBalance}`);
      
    
    }));

  }

      console.log("Donor list");
      console.log(posList.length, donorList.length);

      // // create a stream
      const stream = fs.createWriteStream('accounts_donor.txt', { flags: 'a' });

      // append data to the file
      donorList.forEach(item => {
        stream.write(`${item}\n`);
      })

      // end stream
      stream.end();

      console.log("Writing is completed");

};

getAccountsList();
run();

