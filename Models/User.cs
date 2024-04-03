using Microsoft.AspNetCore.Identity;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace BookShop.Models
{
    public class User : IdentityUser
    {
        public List<CartItems> CartItems { get; set; }
        public TheCart Cart { get; set; }

    }
}
