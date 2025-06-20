# QueryCraft

A powerful database query tool that supports natural language to SQL conversion.

## Features

- Natural language to SQL conversion
- Multiple database connection support
- Query history and management
- GitHub Enterprise authentication (optional)
- Modern and intuitive UI
- User-friendly unauthorized access handling
- SQLite (default) and MySQL database support
- **Embed sharing support**: Easily embed and share queries/results.
- **Query recommendation**: Get smart suggestions for your queries as you type.
- **Sensitive words detection**: Automated workflow to help protect against sensitive data exposure.
- **Dark mode support**: Enjoy a visually comfortable interface with full dark mode compatibility.
- **Split window view for query results**: View your queries and their results side-by-side for enhanced productivity.

## Getting Started

### Prerequisites

- Node.js 18.x or later
- (Optional) GitHub Enterprise account for authentication
- (Optional) MySQL database if not using default SQLite

### Installation

1. Clone the repository:
    ```bash
    git clone git@github.com:rakutentech/query-craft.git 
    cd query-craft
    ```

2. Install dependencies:
    ```bash
    npm install
    ```

3. Create a `.env` file based on `.env.template`:
    ```bash
    cp .env.template .env
    ```

4. Configure environment variables:
    ```env
    # Application Configuration
    NEXT_PUBLIC_BASE_PATH=

    # Database Configuration (Optional - defaults to SQLite)
    APP_DB_DRIVER=sqlite # Set to 'mysql' to use MySQL instead of SQLite
    APP_DB_HOST=your_mysql_host
    APP_DB_PORT=your_mysql_port
    APP_DB_USER=your_mysql_user
    APP_DB_PASSWORD=your_mysql_password
    APP_DB_NAME=your_database_name

    # Authentication (Optional)
    NEXT_PUBLIC_ENABLE_OAUTH=false  # Set to true to enable GitHub authentication
    OAUTH_GITHUB_ID=your_github_client_id
    OAUTH_GITHUB_SECRET=your_github_client_secret
    OAUTH_GITHUB_ENTERPRISE_URL=your_github_enterprise_url
    NEXTAUTH_URL=your_app_base_url
    NEXTAUTH_SECRET=your_nextauth_secret

    # Azure OpenAI Configuration
    AZURE_OPENAI_API_KEY=your_azure_openai_api_key
    AZURE_OPENAI_API_BASE=your_azure_openai_api_base
    AZURE_OPENAI_API_VERSION=your_azure_openai_api_version
    AZURE_OPENAI_API_DEPLOYMENT=your_azure_openai_api_deployment
    PROXY_URL=proxy_of_azure_openai

    # Sensitive words detection pattern
    SENSITIVE_WORDS_PATTERN=your_pattern_here
    ```

5. Set up the database:
    - For SQLite (default): No setup required, database will be created automatically.
    - For MySQL: Run the schema script
    ```bash
    mysql -u your_user -p your_database < scripts/query_craft_schema.sql
    ```

6. Start the development server:
    ```bash
    npm run dev
    ```

### Authentication Setup (Optional)

1. Create a GitHub Enterprise OAuth application:
    - Go to your GitHub Enterprise instance
    - Navigate to Settings > Developer Settings > OAuth Apps
    - Create a new OAuth App with:
        - Application name: QueryCraft
        - Homepage URL: Your application URL
        - Authorization callback URL: `{your-app-url}/api/auth/callback/github`

## Usage

1. Start the application and navigate to `http://localhost:3000`
2. If authentication is enabled:
    - You will be automatically redirected to the GitHub Enterprise login page
    - After successful authentication, your GitHub profile will be displayed in the navigation bar
3. If authentication is disabled:
    - You can use the application directly without signing in
4. Connect to your database:
    - Go to Settings
    - Add your database connection details
5. Start querying:
    - Type your question in natural language
    - View the generated SQL
    - Execute the query and see results
6. Use the new **embed sharing** feature to share queries and results.
7. Enjoy **query recommendations** as you type.
8. Sensitive words detection is now automatically applied to your queries.
9. Switch between light and dark mode for a comfortable viewing experience.
10. Take advantage of the split window view to see your queries and results side-by-side.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.
