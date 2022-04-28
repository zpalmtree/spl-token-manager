# spl-token-manager
A small script to manage some common operations with tokens.

### Configuration

Modify the following variables:

```js
/* Number of decimals for the token */
const TOKEN_DECIMALS = 0;

/* One of 'create', 'mint', 'airdrop', 'verify-airdrop' */
const ACTION = 'create';

const NODE = 'https://ssc-dao.genesysgo.net/';

/* Number of tokens to mint */
const TOKEN_SUPPLY = 100000;
```

You can change `loadSeed` to `loadPrivateKey` if you have the private key in a base58 format, if you exported from phantom, for example.

## Program Usage

### Create

* Create a new token. Token will have 0 decimals by default.

#### Requirements

* Mint private key. Can generate this with `solana-keygen`. Can be a vanity address. Should be located in `mint.json`.

Example:

```json
[251,204,206,182,109,188,156,211,71,63,211,46,193,53,166,0,232,96,64,183,51,199,34,40,134,65,76,19,215,167,134,6,9,101,234,98,247,199,77,184,236,192,250,110,96,246,145,124,139,138,12,45,124,94,217,100,79,101,142,90,187,32,53,142]
```

* Private key to pay for token creation. Will cost around 0.002 SOL. Should be located in `privateKey.json`. Same format as mint private key.

### Mint

* Mint tokens for a mint you have already created.

#### Requirements

* Mint private key. Can generate this with `solana-keygen`. Can be a vanity address. Should be located in `mint.json`.
* Private key to pay for token creation. Will cost around 0.002 SOL. Should be located in `privateKey.json`. Same format as mint private key.

### Airdrop

* Airdrop created tokens to specific addresses

#### Requirements

* Mint private key. Can generate this with `solana-keygen`. Can be a vanity address. Should be located in `mint.json`.
* Private key to pay for token creation. Will cost around 0.002 SOL. Should be located in `privateKey.json`. Same format as mint private key.
* Airdrop destinations. Should be a JSON array with elements 'addr' and 'count'.

Example:

```json
[
    {
        "addr": "3Ycvz1q5uaqSiMYVoGuHM9D865gzKFHcKt2MsSrBS7Xn",
        "count": 1
    },
    {
        "addr": "EPuAgBXH6nyfHwHo5k8QX7vGA1y1T7W32mFS9TY2Wx7g",
        "count": 2
    }
]
```

### Verify Airdrop

* Verify airdrop completed successfully

#### Requirements

* Mint private key. Can generate this with `solana-keygen`. Can be a vanity address. Should be located in `mint.json`.
* Private key to pay for token creation. Will cost around 0.002 SOL. Should be located in `privateKey.json`. Same format as mint private key.
* Airdrop destinations. Should be a JSON array with elements 'addr' and 'count'.
