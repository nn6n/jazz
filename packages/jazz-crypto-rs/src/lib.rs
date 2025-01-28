use wasm_bindgen::prelude::*;

/// Generate a 24-byte nonce from input material using BLAKE3
#[wasm_bindgen]
pub fn generate_nonce(nonce_material: &[u8]) -> Vec<u8> {
    let mut hasher = blake3::Hasher::new();
    hasher.update(nonce_material);
    hasher.finalize().as_bytes()[..24].to_vec()
}

/// Hash data once using BLAKE3
#[wasm_bindgen]
pub fn blake3_hash_once(data: &[u8]) -> Vec<u8> {
    let mut hasher = blake3::Hasher::new();
    hasher.update(data);
    hasher.finalize().as_bytes().to_vec()
}

/// Hash data once using BLAKE3 with a context prefix
#[wasm_bindgen]
pub fn blake3_hash_once_with_context(data: &[u8], context: &[u8]) -> Vec<u8> {
    let mut hasher = blake3::Hasher::new();
    hasher.update(context);
    hasher.update(data);
    hasher.finalize().as_bytes().to_vec()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_nonce_generation() {
        let input = b"test input";
        let nonce = generate_nonce(input);
        assert_eq!(nonce.len(), 24);

        // Same input should produce same nonce
        let nonce2 = generate_nonce(input);
        assert_eq!(nonce, nonce2);

        // Different input should produce different nonce
        let nonce3 = generate_nonce(b"different input");
        assert_ne!(nonce, nonce3);
    }

    #[test]
    fn test_blake3_hash_once() {
        let input = b"test input";
        let hash = blake3_hash_once(input);
        
        // BLAKE3 produces 32-byte hashes
        assert_eq!(hash.len(), 32);
        
        // Same input should produce same hash
        let hash2 = blake3_hash_once(input);
        assert_eq!(hash, hash2);
        
        // Different input should produce different hash
        let hash3 = blake3_hash_once(b"different input");
        assert_ne!(hash, hash3);
    }

    #[test]
    fn test_blake3_hash_once_with_context() {
        let input = b"test input";
        let context = b"test context";
        let hash = blake3_hash_once_with_context(input, context);
        
        // BLAKE3 produces 32-byte hashes
        assert_eq!(hash.len(), 32);
        
        // Same input and context should produce same hash
        let hash2 = blake3_hash_once_with_context(input, context);
        assert_eq!(hash, hash2);
        
        // Different input should produce different hash
        let hash3 = blake3_hash_once_with_context(b"different input", context);
        assert_ne!(hash, hash3);
        
        // Different context should produce different hash
        let hash4 = blake3_hash_once_with_context(input, b"different context");
        assert_ne!(hash, hash4);
        
        // Hash with context should be different from hash without context
        let hash_no_context = blake3_hash_once(input);
        assert_ne!(hash, hash_no_context);
    }
}
