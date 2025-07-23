// Cloud storage integration utilities
export interface CloudFile {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  downloadUrl?: string;
  thumbnailUrl?: string;
  modifiedTime: string;
  provider: 'google_drive' | 'dropbox';
}

export interface CloudStorageProvider {
  name: string;
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  listFiles: (query?: string) => Promise<CloudFile[]>;
  downloadFile: (fileId: string) => Promise<Blob>;
  uploadFile: (file: Blob, name: string) => Promise<string>;
}

// Google Drive integration
export class GoogleDriveProvider implements CloudStorageProvider {
  name = 'Google Drive';
  private accessToken: string | null = null;

  get isConnected(): boolean {
    return !!this.accessToken && this.isTokenValid();
  }

  private isTokenValid(): boolean {
    // Check if token exists and is not expired
    const tokenData = localStorage.getItem('google_drive_token');
    if (!tokenData) return false;
    
    try {
      const { token, expiresAt } = JSON.parse(tokenData);
      return Date.now() < expiresAt;
    } catch {
      return false;
    }
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Load Google APIs
      if (typeof window.gapi === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://apis.google.com/js/api.js';
        script.onload = () => this.initializeGapi().then(resolve).catch(reject);
        script.onerror = () => reject(new Error('Failed to load Google APIs'));
        document.head.appendChild(script);
      } else {
        this.initializeGapi().then(resolve).catch(reject);
      }
    });
  }

  private async initializeGapi(): Promise<void> {
    return new Promise((resolve, reject) => {
      window.gapi.load('auth2:client', async () => {
        try {
          await window.gapi.client.init({
            apiKey: process.env.VITE_GOOGLE_API_KEY,
            clientId: process.env.VITE_GOOGLE_CLIENT_ID,
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
            scope: 'https://www.googleapis.com/auth/drive.readonly'
          });

          const authInstance = window.gapi.auth2.getAuthInstance();
          
          if (authInstance.isSignedIn.get()) {
            this.setAccessToken();
            resolve();
          } else {
            const user = await authInstance.signIn();
            this.setAccessToken();
            resolve();
          }
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  private setAccessToken(): void {
    const authInstance = window.gapi.auth2.getAuthInstance();
    const user = authInstance.currentUser.get();
    const authResponse = user.getAuthResponse();
    
    this.accessToken = authResponse.access_token;
    
    // Store token with expiration
    localStorage.setItem('google_drive_token', JSON.stringify({
      token: this.accessToken,
      expiresAt: Date.now() + (authResponse.expires_in * 1000)
    }));
  }

  async disconnect(): Promise<void> {
    const authInstance = window.gapi.auth2.getAuthInstance();
    await authInstance.signOut();
    this.accessToken = null;
    localStorage.removeItem('google_drive_token');
  }

  async listFiles(query: string = ''): Promise<CloudFile[]> {
    if (!this.isConnected) {
      throw new Error('Not connected to Google Drive');
    }

    const searchQuery = query 
      ? `name contains '${query}' and mimeType='application/pdf'`
      : "mimeType='application/pdf'";

    const response = await window.gapi.client.drive.files.list({
      q: searchQuery,
      fields: 'files(id,name,size,mimeType,modifiedTime,thumbnailLink)',
      orderBy: 'modifiedTime desc',
      pageSize: 20
    });

    return response.result.files.map((file: any) => ({
      id: file.id,
      name: file.name,
      size: parseInt(file.size) || 0,
      mimeType: file.mimeType,
      thumbnailUrl: file.thumbnailLink,
      modifiedTime: file.modifiedTime,
      provider: 'google_drive' as const
    }));
  }

  async downloadFile(fileId: string): Promise<Blob> {
    if (!this.isConnected) {
      throw new Error('Not connected to Google Drive');
    }

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
      {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      }
    );

    if (!response.ok) {
      throw new Error('Failed to download file from Google Drive');
    }

    return response.blob();
  }

  async uploadFile(file: Blob, name: string): Promise<string> {
    if (!this.isConnected) {
      throw new Error('Not connected to Google Drive');
    }

    const metadata = {
      name: name
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', file);

    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        },
        body: form
      }
    );

    if (!response.ok) {
      throw new Error('Failed to upload file to Google Drive');
    }

    const result = await response.json();
    return result.id;
  }
}

// Dropbox integration
export class DropboxProvider implements CloudStorageProvider {
  name = 'Dropbox';
  private accessToken: string | null = null;

  get isConnected(): boolean {
    return !!this.accessToken;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Load Dropbox SDK
      if (typeof window.Dropbox === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/dropbox/dist/Dropbox-sdk.min.js';
        script.onload = () => this.initializeDropbox().then(resolve).catch(reject);
        script.onerror = () => reject(new Error('Failed to load Dropbox SDK'));
        document.head.appendChild(script);
      } else {
        this.initializeDropbox().then(resolve).catch(reject);
      }
    });
  }

  private async initializeDropbox(): Promise<void> {
    const dbx = new window.Dropbox.Dropbox({ 
      clientId: process.env.VITE_DROPBOX_APP_KEY,
      fetch: fetch
    });

    // Check if we have a stored token
    const storedToken = localStorage.getItem('dropbox_token');
    if (storedToken) {
      this.accessToken = storedToken;
      dbx.setAccessToken(storedToken);
      
      // Verify token is still valid
      try {
        await dbx.usersGetCurrentAccount();
        return;
      } catch {
        localStorage.removeItem('dropbox_token');
      }
    }

    // Redirect to Dropbox OAuth
    const authUrl = dbx.getAuthenticationUrl(window.location.origin + '/oauth/dropbox');
    window.location.href = authUrl;
  }

  async handleOAuthCallback(code: string): Promise<void> {
    const dbx = new window.Dropbox.Dropbox({ 
      clientId: process.env.VITE_DROPBOX_APP_KEY,
      fetch: fetch
    });

    try {
      const response = await dbx.getAccessTokenFromCode(window.location.origin + '/oauth/dropbox', code);
      this.accessToken = response.result.access_token;
      localStorage.setItem('dropbox_token', this.accessToken);
    } catch (error) {
      throw new Error('Failed to authenticate with Dropbox');
    }
  }

  async disconnect(): Promise<void> {
    this.accessToken = null;
    localStorage.removeItem('dropbox_token');
  }

  async listFiles(query: string = ''): Promise<CloudFile[]> {
    if (!this.isConnected) {
      throw new Error('Not connected to Dropbox');
    }

    const dbx = new window.Dropbox.Dropbox({ 
      accessToken: this.accessToken,
      fetch: fetch
    });

    try {
      let searchResults: any[] = [];

      if (query) {
        const searchResponse = await dbx.filesSearchV2({
          query,
          options: {
            path: '',
            max_results: 20,
            file_status: 'active',
            filename_only: true
          }
        });
        searchResults = searchResponse.result.matches
          .filter((match: any) => match.metadata.metadata.name.endsWith('.pdf'))
          .map((match: any) => match.metadata.metadata);
      } else {
        const listResponse = await dbx.filesListFolder({
          path: '',
          recursive: true
        });
        searchResults = listResponse.result.entries
          .filter((entry: any) => entry['.tag'] === 'file' && entry.name.endsWith('.pdf'));
      }

      return searchResults.map((file: any) => ({
        id: file.id,
        name: file.name,
        size: file.size || 0,
        mimeType: 'application/pdf',
        modifiedTime: file.client_modified || file.server_modified,
        provider: 'dropbox' as const
      }));
    } catch (error) {
      throw new Error('Failed to list files from Dropbox');
    }
  }

  async downloadFile(fileId: string): Promise<Blob> {
    if (!this.isConnected) {
      throw new Error('Not connected to Dropbox');
    }

    const dbx = new window.Dropbox.Dropbox({ 
      accessToken: this.accessToken,
      fetch: fetch
    });

    try {
      const response = await dbx.filesDownload({ path: fileId });
      return response.result.fileBinary;
    } catch (error) {
      throw new Error('Failed to download file from Dropbox');
    }
  }

  async uploadFile(file: Blob, name: string): Promise<string> {
    if (!this.isConnected) {
      throw new Error('Not connected to Dropbox');
    }

    const dbx = new window.Dropbox.Dropbox({ 
      accessToken: this.accessToken,
      fetch: fetch
    });

    try {
      const response = await dbx.filesUpload({
        path: '/' + name,
        contents: file,
        mode: 'add',
        autorename: true
      });
      return response.result.id;
    } catch (error) {
      throw new Error('Failed to upload file to Dropbox');
    }
  }
}

// Cloud storage manager
export class CloudStorageManager {
  private providers: Map<string, CloudStorageProvider> = new Map();

  constructor() {
    this.providers.set('google_drive', new GoogleDriveProvider());
    this.providers.set('dropbox', new DropboxProvider());
  }

  getProvider(providerId: string): CloudStorageProvider | undefined {
    return this.providers.get(providerId);
  }

  getConnectedProviders(): CloudStorageProvider[] {
    return Array.from(this.providers.values()).filter(provider => provider.isConnected);
  }

  getAllProviders(): CloudStorageProvider[] {
    return Array.from(this.providers.values());
  }

  async searchAllProviders(query: string): Promise<CloudFile[]> {
    const connectedProviders = this.getConnectedProviders();
    const searchPromises = connectedProviders.map(provider => 
      provider.listFiles(query).catch(() => [])
    );
    
    const results = await Promise.all(searchPromises);
    return results.flat().sort((a, b) => 
      new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime()
    );
  }
}

// Global instance
export const cloudStorageManager = new CloudStorageManager();

// Type declarations for external libraries
declare global {
  interface Window {
    gapi: any;
    Dropbox: any;
  }
}