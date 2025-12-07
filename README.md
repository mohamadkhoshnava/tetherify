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

## Scheduling (Crontab)

To run the script automatically at regular intervals (e.g., every 5 minutes), you can use `crontab`.

1.  **Open your crontab configuration:**
    Run the following command in your terminal:
    ```bash
    crontab -e
    ```

2.  **Add the cron job:**
    Add the following line to the end of the file. Make sure to replace `/path/to/python` and `/path/to/project` with your actual paths.

    ```cron
    */5 * * * * cd /path/to/project && /path/to/python get_tether_prices.py >> cron.log 2>&1
    ```

    *Tip: You can find your python path by running `which python3` and your project path by running `pwd` inside the project folder.*
