#[cfg(test)]
mod tests {
    // Utility function tests

    #[test]
    fn test_string_manipulation() {
        let test_string = "test_string";
        assert_eq!(test_string.len(), 11);
    }

    #[test]
    fn test_number_operations() {
        let num1 = 10;
        let num2 = 5;
        assert_eq!(num1 + num2, 15);
        assert_eq!(num1 - num2, 5);
        assert_eq!(num1 * num2, 50);
        assert_eq!(num1 / num2, 2);
    }

    #[test]
    fn test_option_handling() {
        let some_value = Some(42);
        assert_eq!(some_value.unwrap(), 42);

        let none_value: Option<i32> = None;
        assert!(none_value.is_none());
    }

    #[test]
    fn test_result_handling() {
        let ok_result: Result<i32, &str> = Ok(42);
        assert!(ok_result.is_ok());
        assert_eq!(ok_result.unwrap(), 42);

        let err_result: Result<i32, &str> = Err("error");
        assert!(err_result.is_err());
    }
}

