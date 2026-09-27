export default async function handler(req, res) {
    const { license_key, product_id } = req.body;
    const GUMROAD_TOKEN = process.env.GUMROAD_ACCESS_TOKEN;

    try {
        const response = await fetch('https://api.gumroad.com/v2/licenses/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                access_token: GUMROAD_TOKEN,
                license_key: license_key,
                product_id: product_id
            })
        });

        const data = await response.json();
        if (data.success) {
            return res.status(200).json({ valid: true, purchase: data.purchase });
        } else {
            return res.status(400).json({ valid: false, message: 'Licencia no válida' });
        }
    } catch (error) {
        return res.status(500).json({ error: 'Error al conectar con Gumroad' });
    }
}