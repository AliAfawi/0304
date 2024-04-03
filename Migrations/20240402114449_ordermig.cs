using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace BookShop.Migrations
{
    /// <inheritdoc />
    public partial class ordermig : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_OrderBooks_Books_bookId",
                table: "OrderBooks");

            migrationBuilder.DropForeignKey(
                name: "FK_OrderBooks_Orders_OrderId",
                table: "OrderBooks");

            migrationBuilder.RenameColumn(
                name: "bookId",
                table: "OrderBooks",
                newName: "BookID");

            migrationBuilder.RenameColumn(
                name: "OrderId",
                table: "OrderBooks",
                newName: "OrderID");

            migrationBuilder.RenameIndex(
                name: "IX_OrderBooks_OrderId",
                table: "OrderBooks",
                newName: "IX_OrderBooks_OrderID");

            migrationBuilder.RenameIndex(
                name: "IX_OrderBooks_bookId",
                table: "OrderBooks",
                newName: "IX_OrderBooks_BookID");

            migrationBuilder.AddForeignKey(
                name: "FK_OrderBooks_Books_BookID",
                table: "OrderBooks",
                column: "BookID",
                principalTable: "Books",
                principalColumn: "BookID",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_OrderBooks_Orders_OrderID",
                table: "OrderBooks",
                column: "OrderID",
                principalTable: "Orders",
                principalColumn: "OrderID",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_OrderBooks_Books_BookID",
                table: "OrderBooks");

            migrationBuilder.DropForeignKey(
                name: "FK_OrderBooks_Orders_OrderID",
                table: "OrderBooks");

            migrationBuilder.RenameColumn(
                name: "OrderID",
                table: "OrderBooks",
                newName: "OrderId");

            migrationBuilder.RenameColumn(
                name: "BookID",
                table: "OrderBooks",
                newName: "bookId");

            migrationBuilder.RenameIndex(
                name: "IX_OrderBooks_OrderID",
                table: "OrderBooks",
                newName: "IX_OrderBooks_OrderId");

            migrationBuilder.RenameIndex(
                name: "IX_OrderBooks_BookID",
                table: "OrderBooks",
                newName: "IX_OrderBooks_bookId");

            migrationBuilder.AddForeignKey(
                name: "FK_OrderBooks_Books_bookId",
                table: "OrderBooks",
                column: "bookId",
                principalTable: "Books",
                principalColumn: "BookID",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_OrderBooks_Orders_OrderId",
                table: "OrderBooks",
                column: "OrderId",
                principalTable: "Orders",
                principalColumn: "OrderID",
                onDelete: ReferentialAction.Cascade);
        }
    }
}
