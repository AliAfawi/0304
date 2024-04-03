using System.ComponentModel.DataAnnotations;

namespace BookShop.ViewModels
{
    public class ResetVM
    {
        [Required(ErrorMessage = "Email is required.")]
        [DataType(DataType.EmailAddress)]

        public string? Email { get; set; }

        [Required(ErrorMessage = "Old Password is required.")]
        [DataType(DataType.Password)]
        public string? OldPassword { get; set; }
        [Required(ErrorMessage = "New Password is required.")]
        [DataType(DataType.Password)]
        public string? NewPassword { get; set; }
    }
}
