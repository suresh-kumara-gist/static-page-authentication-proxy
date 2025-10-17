import express from 'express';
import cors from 'cors';
import { AuthorizationCode } from 'simple-oauth2';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 9050;

// Basic CORS
app.use(cors());
app.use(express.json());

const oauth2 = new AuthorizationCode({
  client: {
    id: process.env.GITHUB_CLIENT_ID,
    secret: process.env.GITHUB_CLIENT_SECRET
  },
  auth: {
    tokenHost: 'https://github.com',
    tokenPath: '/login/oauth/access_token',
    authorizePath: '/login/oauth/authorize'
  }
});

// Start OAuth - open this URL in popup
app.get('/auth/github', (req, res) => {
  const authUrl = oauth2.authorizeURL({
    redirect_uri: process.env.GITHUB_REDIRECT_URI,
    scope: 'repo'
  });
  res.redirect(authUrl);
});

app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;

  try {
    const tokenParams = {
      code,
      redirect_uri: process.env.GITHUB_REDIRECT_URI,
    };

    const accessToken = await oauth2.getToken(tokenParams);

    console.log("------- accessToken ---------------");
    console.log(accessToken);
    const token = accessToken.token.access_token;

    const content = {
      token,
      provider: "github"
    };

    const script = `
    <script>
      (function() {
        function recieveMessage(e) {
          console.log("recieveMessage %o", e);
          window.opener.postMessage(
            'authorization:github:success:${JSON.stringify(content)}',
            e.origin
          );
        }
        window.addEventListener("message", recieveMessage, false);
        window.opener.postMessage("authorizing:github", "*");
      })();
    </script>`;
    
    res.send(script);
  } catch (error) {
    console.error('Auth error:', error);
    const errorScript = `
      <script>
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage('authorization:github:error', "*");
        }
        setTimeout(() => window.close(), 2000);
      </script>
      <body>Authentication failed. Closing window...</body>
    `;
    res.send(errorScript);
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Auth server running on http://<backend>`);
});
