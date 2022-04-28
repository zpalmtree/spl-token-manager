import { MintLayout, Token, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import {
    ParsedAccountData,
    Connection,
    Keypair,
    SystemProgram,
    Transaction,
    sendAndConfirmTransaction,
    SYSVAR_RENT_PUBKEY,
    PublicKey,
    TransactionInstruction,
} from '@solana/web3.js';
import { readFile } from 'fs/promises';
import bs58 from 'bs58';
import fetch from 'node-fetch';

/* Number of decimals for the token */
const TOKEN_DECIMALS = 0;

/* One of 'create', 'mint', 'airdrop', 'verify-airdrop' */
const ACTION = 'create';

const NODE = 'https://ssc-dao.genesysgo.net/';

/* Number of tokens to mint */
const TOKEN_SUPPLY = 100000;

interface Destination {
    addr: string;
    count: number;
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function verifyAirdrop(
    sourceWallet: Keypair,
    mint: PublicKey,
    connection: Connection,
    destinations: Destination[],
) {
    const token = new Token(
        connection,
        mint,
        TOKEN_PROGRAM_ID,
        sourceWallet,
    );

    const sourceTokenAccount = await token.getOrCreateAssociatedAccountInfo(
        sourceWallet.publicKey,
    )

    const addressMapping = [];

    let failed = [];
    let success = [];

    for (const destination of destinations) {
        while (true) {
            const newTokenOwner = new PublicKey(destination.addr);

            console.log(`\n\nChecking balance of ${destination.addr}...`);

            let targetAccount;

            try {
                targetAccount = await token.getOrCreateAssociatedAccountInfo(
                    newTokenOwner,
                )
            } catch (err) {
                console.log(`Failed to create token account for ${destination.addr}: ${err.toString()}`);
                continue;
            }

            try {
                const { amount } = await token.getAccountInfo(targetAccount.address);

                console.log(`Balance: ${amount.toNumber()}`);

                if (amount.toNumber() < destination.count) {
                    failed.push({
                        destination,
                        expected: destination.count,
                        actual: amount.toNumber(),
                    });
                } else {
                    success.push(destination);
                }
            } catch (err) {
                console.log(`Failed to get account info: ${err.toString()}`);

                await sleep(10 * 1000);

                continue;
            }

            break;
        }
    }

    if (failed.length > 0) {
        console.log(`Failed:`);
        console.log(JSON.stringify(failed, null, 4));
    }

    console.log(`Complete: [${success.length} / ${success.length + failed.length}]`);
}

async function airdropTokens(
    sourceWallet: Keypair,
    mint: PublicKey,
    connection: Connection,
    destinations: Destination[],
) {
    const token = new Token(
        connection,
        mint,
        TOKEN_PROGRAM_ID,
        sourceWallet,
    );

    const sourceTokenAccount = await token.getOrCreateAssociatedAccountInfo(
        sourceWallet.publicKey,
    )

    const { amount } = await token.getAccountInfo(sourceTokenAccount.address);

    console.log(`Token balance: ${amount.toNumber()}`);

    let transferCount = 0;

    for (const destination of destinations) {
        transferCount += destination.count;
    }

    console.log(`Tokens to be sent: ${transferCount}.`);

    if (transferCount > amount.toNumber()) {
        throw new Error('Not enough tokens found');
    }

    const addressMapping = [];

    let failed = [];

    for (const destination of destinations) {
        while (true) {
            const newTokenOwner = new PublicKey(destination.addr);

            console.log(`\n\nSending ${destination.count} tokens to ${destination.addr}...`);

            let targetAccount;

            try {
                targetAccount = await token.getOrCreateAssociatedAccountInfo(
                    newTokenOwner,
                )
            } catch (err) {
                console.log(`Failed to create token account for ${destination.addr}: ${err.toString()}`);
                continue;
            }

            try {
                const signature = await token.transfer(
                    sourceTokenAccount.address,
                    targetAccount.address,
                    sourceWallet,
                    [],
                    destination.count,
                );

                console.log(`Signature: ${signature}`);
            } catch (err) {
                console.log(`!! Potentially failed to transfer ${destination.count} tokens to ${destination.addr}: ${err.toString()}`);
                await sleep(10 * 1000);

                failed.push(destination);
                break;
            }

            break;
        }
    }

    if (failed.length > 0) {
        console.log(`Failed:`);
        console.log(JSON.stringify(failed, null, 4));
    }

    console.log(`Finished sending tokens!`);
}

async function mintVanityPaymentToken(
    mintAuthority: Keypair,
    mintPublicKey: PublicKey,
    connection: Connection,
    destination: PublicKey,
    count: number,
) {
    console.log(`Token mint: ${mintPublicKey.toString()}`);

    console.log(`Destination: ${destination.toString()}`);

    const mint = new Token(
        connection,

        /* Token public key */
        mintPublicKey,

        TOKEN_PROGRAM_ID,

        /* Account that pays the fee */
        mintAuthority,
    );

    const destinationAccount = await mint.getOrCreateAssociatedAccountInfo(
        destination,
    );

    console.log(`Minting...`);

    await mint.mintTo(
        /* Destination */
        destinationAccount.address,

        /* Mint authority */
        mintAuthority,

        [],

        count,
    );

    console.log(`Complete!`);
}

async function createVanityPaymentToken(
    walletKeyPair: Keypair,
    vanityKeyPair: Keypair,
    connection: Connection,
) {
    console.log(`Creating token...`);

    const mint = new Token(
        connection,

        /* Token public key */
        vanityKeyPair.publicKey,

        TOKEN_PROGRAM_ID,

        /* Account that pays the fee */
        walletKeyPair,
    );

    // Allocate memory for the account
    const balanceNeeded = await Token.getMinBalanceRentForExemptMint(
        connection,
    );

    const transaction = new Transaction();

    transaction.add(
        SystemProgram.createAccount({
            fromPubkey: walletKeyPair.publicKey,
            newAccountPubkey: vanityKeyPair.publicKey,
            lamports: balanceNeeded,
            space: MintLayout.span,
            programId: TOKEN_PROGRAM_ID,
        }),
    );

    transaction.add(
        Token.createInitMintInstruction(
            TOKEN_PROGRAM_ID,

            vanityKeyPair.publicKey,

            /* 0 decimals */
            TOKEN_DECIMALS,

            /* Mint authority */
            walletKeyPair.publicKey,

            /* Freeze authority */
            null,
        ),
    );

    // Send the two instructions
    await sendAndConfirmTransaction(
        connection,
        transaction,
        [ walletKeyPair, vanityKeyPair ],
        { commitment: 'finalized' },
    );

    const mintAddress = mint.publicKey.toBase58();

    console.log(`Created token ${mintAddress}`);

    console.log(`Creating token account for ${walletKeyPair.publicKey.toBase58()}...`);

    const toTokenAccount = await mint.getOrCreateAssociatedAccountInfo(
        walletKeyPair.publicKey,
    );

    console.log(`User token account: ${toTokenAccount.address.toBase58()}`);

    console.log('Complete');
}

async function loadPrivateKey(filename: string): Promise<Keypair> {
    const privateKey = JSON.parse((await readFile(filename, { encoding: 'utf-8' })));
    const bytes = bs58.decode(privateKey);
    const wallet = Keypair.fromSecretKey(new Uint8Array(bytes));
    return wallet;
}

async function loadSeed(filename: string): Promise<Keypair> {
    const privateKey = JSON.parse((await readFile(filename, { encoding: 'utf-8' })));
    const wallet = Keypair.fromSecretKey(new Uint8Array(privateKey));
    return wallet;
}

async function loadDestinations(filename: string): Promise<Destination[]> {
    const items = JSON.parse((await readFile(filename, { encoding: 'utf-8' })));
    return items;
}

async function main() {
    const mint = await loadSeed('mint.json');
    const wallet = await loadSeed('privateKey.json');

    console.log(`Mint: ${mint.publicKey.toString()}`);
    console.log(`Wallet: ${wallet.publicKey.toString()}`);

    const connection = new Connection(NODE, {
        confirmTransactionInitialTimeout: 60 * 1000,
        commitment: 'confirmed',
    });

    switch (ACTION as string) {
        case 'create': {
            await createVanityPaymentToken(
                wallet,
                mint,
                connection,
            );

            break;
        }
        case 'mint': {
            await mintVanityPaymentToken(
                wallet,
                mint.publicKey,
                connection,
                wallet.publicKey,
                TOKEN_SUPPLY,
            );

            break;
        }
        case 'airdrop': {
            const destinations = await loadDestinations('airdrop.json');

            await airdropTokens(
                wallet,
                mint.publicKey,
                connection,
                destinations,
            );

            break;
        }
        case 'verify-airdrop': {
            const destinations = await loadDestinations('airdrop.json');

            await verifyAirdrop(
                wallet,
                mint.publicKey,
                connection,
                destinations,
            );

            break;
        }
    }
}

main()
    .catch((err) => {
        console.log(`Error executing script: ${err.toString()}`);
    });
