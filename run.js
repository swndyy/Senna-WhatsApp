const chalk = require('chalk');
const { spawn } = require('child_process');

function showHeader() {
    console.log(chalk.green.bold('╔══════════════════════════════════════════╗'));
    console.log(chalk.green.bold('║         🌟 PANEL SIAP DIGUNAKAN 🌟         ║'));
    console.log(chalk.green.bold('╚══════════════════════════════════════════╝'));
}
function showInstructions() {
    console.log(chalk.cyan.bold('👉 Langkah-langkah untuk memulai:'));
    console.log(chalk.cyan('1️⃣ Masukkan perintah yang Anda inginkan.'));
    console.log(chalk.cyan('2️⃣ Tekan Enter untuk menjalankan.'));
    console.log(chalk.yellow('💡 Tips: Anda dapat menggunakan perintah bash standar.'));
    console.log(chalk.yellow('🔄 Menunggu input dari pengguna...\n'));
}

function startPanel() {
    spawn('bash', [], {
        stdio: ['inherit', 'inherit', 'inherit', 'ipc'] // Mengatur aliran I/O
    });
}
try {
    showHeader();
    showInstructions();
    startPanel();
} catch (error) {
    console.error(chalk.red.bold('❌ Terjadi kesalahan:'), error.message); 
}