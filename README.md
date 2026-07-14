# tmi_soa_translator
tmi soa files translator

1. Bypass PowerShell Execution Policy (If needed)
If your system blocks npm scripts due to execution policies (common on corporate/work machines), run the following command in your current PowerShell window to temporarily bypass the restriction for this session:
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process

2. Install Dependencies
Navigate to the project's root directory and run the package installation:
npm install

3. Run the Development Server
Once the installation is complete, start the local Vite development server:
npm run dev

4. Access the App
The server will boot up almost instantly. Open your browser and navigate to the local address provided in the terminal output, typically:
http://localhost:5173