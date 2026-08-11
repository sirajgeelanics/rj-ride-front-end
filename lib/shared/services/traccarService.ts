// Traccar GPS Tracking Service
// Supports both mock data and real Traccar API integration

export interface TraccarPosition {
  id: number;
  deviceId: number;
  protocol?: string;
  deviceTime: string;
  fixTime: string;
  serverTime: string;
  latitude: number;
  longitude: number;
  altitude: number;
  speed: number; // km/h
  course: number; // bearing 0-360
  accuracy: number;
  attributes?: Record<string, any>;
}

export interface TraccarDevice {
  id: number;
  name: string;
  uniqueId: string;
  status: 'online' | 'offline' | 'unknown';
  lastUpdate: string;
  positionId: number;
}

export class TraccarService {
  private apiUrl: string;
  private username: string;
  private password: string;
  private useMockData: boolean;
  private mockPositions: Map<number, TraccarPosition> = new Map();

  constructor(config?: { apiUrl?: string; username?: string; password?: string; useMock?: boolean }) {
    this.apiUrl = config?.apiUrl || 'http://localhost:8082';
    this.username = config?.username || '';
    this.password = config?.password || '';
    this.useMockData = config?.useMock !== false; // Default to mock

    this.initializeMockData();
  }

  /**
   * Update service config at runtime (e.g., when user switches from mock to live)
   */
  updateConfig(config: {
    apiUrl?: string;
    username?: string;
    password?: string;
    useMock?: boolean;
  }) {
    if (config.apiUrl !== undefined) this.apiUrl = config.apiUrl;
    if (config.username !== undefined) this.username = config.username;
    if (config.password !== undefined) this.password = config.password;
    if (config.useMock !== undefined) this.useMockData = config.useMock;
  }

  private initializeMockData() {
    // Generate mock positions for testing
    const mockDevices = [
      { id: 1, name: 'Vehicle-001', lat: 12.9716, lng: 77.5946 },
      { id: 2, name: 'Vehicle-002', lat: 12.9756, lng: 77.5886 },
      { id: 3, name: 'Vehicle-003', lat: 12.9676, lng: 77.6006 },
      { id: 4, name: 'Vehicle-004', lat: 12.9816, lng: 77.5846 },
      { id: 5, name: 'Vehicle-005', lat: 12.9616, lng: 77.5946 },
    ];

    mockDevices.forEach((device) => {
      this.mockPositions.set(device.id, {
        id: device.id,
        deviceId: device.id,
        protocol: 'mock',
        deviceTime: new Date().toISOString(),
        fixTime: new Date().toISOString(),
        serverTime: new Date().toISOString(),
        latitude: device.lat,
        longitude: device.lng,
        altitude: 0,
        speed: Math.random() * 80, // 0-80 km/h
        course: Math.random() * 360,
        accuracy: 5,
      });
    });
  }

  /**
   * Get current position of a device
   */
  async getDevicePosition(deviceId: number): Promise<TraccarPosition | null> {
    if (this.useMockData) {
      return this.getMockPosition(deviceId);
    }

    try {
      const response = await fetch(`${this.apiUrl}/api/positions?deviceId=${deviceId}`, {
        headers: {
          Authorization: `Basic ${btoa(`${this.username}:${this.password}`)}`,
        },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const positions = await response.json();
      return positions[0] || null;
    } catch (error) {
      console.error('Traccar API error:', error);
      return null;
    }
  }

  /**
   * Get positions for multiple devices
   */
  async getDevicesPositions(deviceIds: number[]): Promise<Map<number, TraccarPosition>> {
    const positions = new Map<number, TraccarPosition>();

    if (this.useMockData) {
      deviceIds.forEach((id) => {
        const pos = this.getMockPosition(id);
        if (pos) positions.set(id, pos);
      });
      return positions;
    }

    try {
      const response = await fetch(`${this.apiUrl}/api/positions`, {
        headers: {
          Authorization: `Basic ${btoa(`${this.username}:${this.password}`)}`,
        },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const allPositions = await response.json();

      deviceIds.forEach((deviceId) => {
        const pos = allPositions.find((p: any) => p.deviceId === deviceId);
        if (pos) positions.set(deviceId, pos);
      });
    } catch (error) {
      console.error('Traccar API error:', error);
    }

    return positions;
  }

  /**
   * Get device information
   */
  async getDevice(deviceId: number): Promise<TraccarDevice | null> {
    if (this.useMockData) {
      return this.getMockDevice(deviceId);
    }

    try {
      const response = await fetch(`${this.apiUrl}/api/devices/${deviceId}`, {
        headers: {
          Authorization: `Basic ${btoa(`${this.username}:${this.password}`)}`,
        },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Traccar API error:', error);
      return null;
    }
  }

  /**
   * Fetch all devices from Traccar
   */
  async fetchDevices(): Promise<TraccarDevice[]> {
    if (this.useMockData) {
      return [1, 2, 3, 4, 5].map((id) => this.getMockDevice(id));
    }

    try {
      const response = await fetch(`${this.apiUrl}/api/devices`, {
        headers: {
          Authorization: `Basic ${btoa(`${this.username}:${this.password}`)}`,
        },
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Traccar API error:', error);
      return [];
    }
  }

  // NOTE: Lookups by uniqueId should use the store's devicesByUniqueId map
  // (populated by fetchDevices() -> setDevices()) for efficiency

  /**
   * Create a new device in Traccar
   */
  async createDevice(name: string, uniqueId: string): Promise<TraccarDevice | null> {
    if (this.useMockData) {
      return {
        id: Math.floor(Math.random() * 10000),
        name,
        uniqueId,
        status: 'offline',
        lastUpdate: new Date().toISOString(),
        positionId: 0,
      };
    }

    try {
      const response = await fetch(`${this.apiUrl}/api/devices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${btoa(`${this.username}:${this.password}`)}`,
        },
        body: JSON.stringify({ name, uniqueId }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('Traccar API error:', error);
      return null;
    }
  }

  /**
   * Get Traccar dashboard URL for a device
   */
  getDashboardUrl(deviceId: number): string {
    return `${this.apiUrl}/#/device/${deviceId}`;
  }

  /**
   * Update mock position (for simulation)
   */
  updateMockPosition(deviceId: number, latitude: number, longitude: number, speed: number = 0) {
    const current = this.mockPositions.get(deviceId);
    if (current) {
      this.mockPositions.set(deviceId, {
        ...current,
        latitude,
        longitude,
        speed,
        fixTime: new Date().toISOString(),
        serverTime: new Date().toISOString(),
      });
    } else {
      // Create new position if none exists
      this.mockPositions.set(deviceId, {
        id: deviceId,
        deviceId,
        protocol: 'mock',
        deviceTime: new Date().toISOString(),
        fixTime: new Date().toISOString(),
        serverTime: new Date().toISOString(),
        latitude,
        longitude,
        altitude: 0,
        speed,
        course: 0,
        accuracy: 5,
      });
    }
  }

  /**
   * Update mock position bearing (for demo route visual)
   */
  updateMockBearing(deviceId: number, course: number) {
    const current = this.mockPositions.get(deviceId);
    if (current) {
      this.mockPositions.set(deviceId, { ...current, course });
    }
  }

  /**
   * Simulate vehicle movement (for testing)
   */
  simulateMovement(deviceId: number, speed: number = 20) {
    const pos = this.mockPositions.get(deviceId);
    if (!pos) return;

    // Move in random direction at given speed
    const bearing = Math.random() * 360;
    const latChange = (speed / 111) * Math.cos((bearing * Math.PI) / 180) / 3600;
    const lngChange = (speed / (111 * Math.cos((pos.latitude * Math.PI) / 180))) * Math.sin((bearing * Math.PI) / 180) / 3600;

    this.updateMockPosition(deviceId, pos.latitude + latChange, pos.longitude + lngChange, speed);
  }

  // Private mock data methods
  private getMockPosition(deviceId: number): TraccarPosition | null {
    const pos = this.mockPositions.get(deviceId);
    if (!pos) return null;

    return {
      ...pos,
      serverTime: new Date().toISOString(),
      speed: Math.max(0, pos.speed + (Math.random() - 0.5) * 5), // Jitter speed
    };
  }

  private getMockDevice(deviceId: number): TraccarDevice {
    const names = ['Vehicle-001', 'Vehicle-VH1', 'Vehicle-VH2', 'Vehicle-VH3', 'Vehicle-VH4', 'Vehicle-VH5'];
    const name = names[deviceId] || `Vehicle-${deviceId}`;
    const uniqueIds = ['', 'TRA-001', 'TRA-002', 'TRA-003', 'TRA-004', 'TRA-005'];

    return {
      id: deviceId,
      name,
      uniqueId: uniqueIds[deviceId] || `TRA-${String(deviceId).padStart(3, '0')}`,
      status: Math.random() > 0.3 ? 'online' : 'offline',
      lastUpdate: new Date(Date.now() - Math.random() * 300000).toISOString(),
      positionId: deviceId,
    };
  }
}

// Create singleton instance
export const traccarService = new TraccarService({ useMock: true });
