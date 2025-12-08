# Tetherify

## Setup

1.  **Create a configured environment file:**
    Create a file named `.env` in the root directory of the project.

2.  **Add your credentials:**
    Copy the following content into your `.env` file and replace the placeholders with your actual values:

    ```env
    TELEGRAM_BOT_TOKEN=your_bot_token_here
    TELEGRAM_CHANNEL_ID=@your_channel_id
    ```
3. **Install dependencies:**
    Make sure you have Python and uv installed, then run:
    ```bash
    uv sync
    ```
4. **Run the application:**
    Start the application using:
    ```bash
    uv run get_tether_prices.py
    ```