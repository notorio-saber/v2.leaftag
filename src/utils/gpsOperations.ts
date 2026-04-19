export const getCurrentPosition = (): Promise<{latitude: number, longitude: number, accuracy: number, timestamp: string}> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("GPS não suportado neste dispositivo."));
      return;
    }
    
    const options = {
      enableHighAccuracy: true,
      timeout: 30000,
      maximumAge: 10000
    };

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: new Date().toLocaleString('pt-BR')
        });
      },
      (error) => {
        let errorMsg = 'Erro ao obter localização';
        if (error.code === error.PERMISSION_DENIED) errorMsg = 'Permissão de localização negada';
        if (error.code === error.POSITION_UNAVAILABLE) errorMsg = 'Localização indisponível';
        if (error.code === error.TIMEOUT) errorMsg = 'Tempo limite de GPS excedido';
        reject(new Error(errorMsg));
      },
      options
    );
  });
};
