using BookShop.Data;
using BookShop.Models;
using BookStore.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace BookShop.Controllers
{
    public class ShoppingCartController : Controller
    {
        private readonly BookStoreContext _context;
        private readonly Microsoft.AspNetCore.Identity.UserManager<User> _userManager;


        public ShoppingCartController(BookStoreContext _context, Microsoft.AspNetCore.Identity.UserManager<User> userManager)
        {
            this._context = _context;
            this._userManager = userManager;
        }
        //public  IActionResult cart()
        //{
        //    return View();
        //}

        public async Task<IActionResult> Cart()
        {
            var user = await _userManager.GetUserAsync(User);
            if (user == null) return Challenge();

            // Assuming each user has a unique cart
            TheCart cart;
            cart = CartManger.GetCart(HttpContext);
            foreach(var item in cart.CartItems) {
                var prod = _context.Books.Find(item.BookID);
                if (prod != null)
                {
                    item.Book = prod;
                }
            }
            return View("Cart",cart);
        }


        [HttpPost]
        public IActionResult Remove(int bookId)
        {
            var cart = CartManger.GetCart(HttpContext);
            CartManger.RemoveFromCart(cart, bookId);
            return RedirectToAction("Cart", "ShoppingCart");
        }
        [HttpPost]
        public async Task<IActionResult> UpdateCartItemQuantity(int productId, int currentQuantity, string change)
        {

            var mainCart = CartManger.GetCart(HttpContext);

            var specificProduct = await _context.Books.FirstOrDefaultAsync(p => p.BookID == productId);
            if (specificProduct != null)
            {
                int newQuantity = currentQuantity + (change == "increase" ? 1 : -1);
                newQuantity = Math.Max(newQuantity, 1);
                newQuantity = Math.Min(newQuantity, specificProduct.StockQuantity);

                CartManger.UpdateCartItemQuantity(mainCart, productId, newQuantity);
            }

            return RedirectToAction("Cart", "ShoppingCart");
        }

        public IActionResult UpdateQuantity(int BookId, string action)
        {
            var cart = CartManger.GetCart(HttpContext);
            if(cart != null)
            {
                var cartitem = cart.CartItems.FirstOrDefault(b => b.BookID == BookId);
                if (cartitem != null)
                {
                    if (action == "increase")
                        cartitem.Quantity += 1;
                    else if (action == "decrease" && cartitem.Quantity > 1)
                        cartitem.Quantity -= 1;
                }
            }
            return RedirectToAction("Cart", "ShoppingCart");
        }

    }
}
